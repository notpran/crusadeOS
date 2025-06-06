// frontend/src/apps/TerminalApp.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNotifications } from '../components/NotificationSystem';
import { useAuth } from '../context/AuthContext'; // Import useAuth for token management

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Path normalization helper for frontend - Moved outside component for stability
const path = {
  join: (...parts) => {
    let joined = parts.join('/').replace(/\/\/+/g, '/');
    if (!joined.startsWith('/')) joined = '/' + joined;
    return joined;
  },
  normalize: (p) => {
    if (p === '/') return '/';
    const parts = p.split('/').filter(Boolean);
    const newParts = [];
    for (const part of parts) {
      if (part === '..') {
        if (newParts.length > 0) {
          newParts.pop();
        }
      } else if (part !== '.') {
        newParts.push(part);
      }
    }
    return '/' + newParts.join('/');
  },
  basename: (p) => { // Simple basename implementation
    const parts = p.split('/').filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : '';
  }
};

// Format file size in human readable format
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};


const TerminalApp = ({ updateInstalledApps }) => {
  const { addNotification } = useNotifications();
  const { token, logout } = useAuth(); // Get token and logout from AuthContext
  const [output, setOutput] = useState([]);
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('/');
  const outputRef = useRef(null);
  const commandHistory = useRef([]);
  const historyIndex = useRef(-1);
  const abortControllerRef = useRef(null);

  // Scroll to bottom on new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const writeOutput = useCallback((text, type = 'info') => {
    setOutput(prev => [...prev, { text, type, timestamp: new Date().toLocaleTimeString() }]);
  }, []);

  const clearOutput = () => {
    setOutput([]);
  };

  const resolvePath = useCallback((inputPath) => {
    let absolutePath;
    if (inputPath.startsWith('/')) {
        absolutePath = inputPath;
    } else if (inputPath === '.' || inputPath === './') {
        absolutePath = cwd;
    } else if (inputPath === '..') {
        const parts = cwd.split('/').filter(Boolean);
        parts.pop();
        absolutePath = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    } else {
        absolutePath = cwd === '/' ? `/${inputPath}` : `${cwd}/${inputPath}`;
    }
    return path.normalize(absolutePath);
  }, [cwd]);

  // Helper function for API calls with proper error handling
  const apiCall = useCallback(async (endpoint, options = {}) => {
    try {
      abortControllerRef.current?.abort(); // Cancel any pending requests
      abortControllerRef.current = new AbortController();

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        const text = await response.text();
        let error;
        try {
          const data = JSON.parse(text);
          error = new Error(data.message || 'Server error');
        } catch {
          error = new Error(text || 'Server error');
        }
        error.status = response.status;
        throw error;
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Please check your connection and try again.');
      }

      if (response.status === 403) {
        writeOutput('Session expired. Please log in again.', 'error');
        addNotification('Session expired. Please log in again.', 'error');
        await logout();
        return null;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Server error');
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      }
      if (error instanceof SyntaxError) {
        // JSON parse error
        writeOutput('Error: Server returned invalid response format', 'error');
        addNotification('Server returned invalid response format', 'error');
      } else {
        writeOutput(`Error: ${error.message}`, 'error');
        addNotification(error.message, 'error');
      }
      throw error;
    }
  }, [token, addNotification, logout, writeOutput]);

  const executeCommand = async (fullCommand) => {
    writeOutput(`> ${fullCommand}`, 'command');
    commandHistory.current.push(fullCommand); // Add to history
    historyIndex.current = commandHistory.current.length; // Reset history index

    const [cmd, ...args] = fullCommand.trim().split(/\s+/);

    try {
      switch (cmd) {
        case 'help':
          writeOutput('Available commands:');
          writeOutput('  ls [path]             - List directory contents.');
          writeOutput('  cd <path>             - Change current directory.');
          writeOutput('  mkdir <name>          - Create a new directory.');
          writeOutput('  cf <name>             - Create an empty file.');
          writeOutput('  cat <file>            - Display file content.');
          writeOutput('  cp <source> <dest>    - Copy a file or folder.');
          writeOutput('  mv <source> <dest>    - Move/rename a file or folder.');
          writeOutput('  rm <file>             - Remove a file.');
          writeOutput('  rmdir <dir>           - Remove an empty directory.');
          writeOutput('  rm -r <dir>           - Remove a directory and its contents recursively.');
          writeOutput('  pkgm install <path>   - Install an application from a .pakapp folder.');
          writeOutput('  pkgm list-installed   - List installed applications.');
          writeOutput('  pkgm uninstall <app_id> - Uninstall an application.');
          writeOutput('  clear                 - Clear terminal output.');
          break;

        case 'ls': {
          const targetPath = args[0] ? resolvePath(args[0]) : cwd;
          writeOutput(`Listing contents of: ${targetPath}`);
          try {
            const data = await apiCall(`/api/cvfs/list?path=${encodeURIComponent(targetPath)}`);
            if (data && Array.isArray(data)) {
              if (data.length === 0) {
                writeOutput(`Directory '${targetPath}' is empty.`);
              } else {
                // Sort items: folders first, then files, alphabetically within each group
                const sorted = [...data].sort((a, b) => {
                  if (a.type === b.type) {
                    return a.name.localeCompare(b.name);
                  }
                  return a.type === 'folder' ? -1 : 1;
                });
                
                writeOutput('Type  Name');
                writeOutput('----  ----');
                sorted.forEach(item => {
                  const icon = item.type === 'folder' ? '📁' : '📄';
                  const size = item.size ? ` (${formatFileSize(item.size)})` : '';
                  writeOutput(`${icon} ${item.name}${size}`);
                });
                writeOutput(`Total: ${data.length} items`);
              }
            } else {
              throw new Error('Invalid response format from server');
            }
          } catch (error) {
            writeOutput(`Failed to list directory: ${error.message}`, 'error');
          }
          break;
        }

        case 'cd': {
            if (args.length === 0) {
                writeOutput('Usage: cd <path>');
                break;
            }
            const targetPath = resolvePath(args[0]);
            try {
              const data = await apiCall(`/api/cvfs/list?path=${encodeURIComponent(targetPath)}`);
              if (data) {
                setCwd(targetPath);
                writeOutput(`Changed directory to ${targetPath}`);
              }
            } catch (error) {
              writeOutput(`Error: ${error.message}`, 'error');
              addNotification(`cd failed: ${error.message}`, 'error');
            }
            break;
        }

        case 'mkdir': {
          if (args.length === 0) {
            writeOutput('Usage: mkdir <name>');
            break;
          }
          const dirName = args[0];
          try {
            const data = await apiCall('/api/cvfs/create', {
              method: 'POST',
              body: JSON.stringify({ path: cwd, name: dirName, type: 'folder' })
            });
            if (data) {
              writeOutput(data.message);
              addNotification(`Folder created: ${dirName}`, 'success');
            }
          } catch (error) {
            writeOutput(`Error: ${error.message}`, 'error');
            addNotification(`mkdir failed: ${error.message}`, 'error');
          }
          break;
        }

        case 'cf': { // Create File
          if (args.length === 0) {
            writeOutput('Usage: cf <name>');
            break;
          }
          const fileName = args[0];
          try {
            const data = await apiCall('/api/cvfs/create', {
              method: 'POST',
              body: JSON.stringify({ path: cwd, name: fileName, type: 'file' })
            });
            if (data) {
              writeOutput(data.message);
              addNotification(`File created: ${fileName}`, 'success');
            }
          } catch (error) {
            writeOutput(`Error: ${error.message}`, 'error');
            addNotification(`cf failed: ${error.message}`, 'error');
          }
          break;
        }

        case 'cat': { // Display file content
            if (args.length === 0) {
                writeOutput('Usage: cat <file>');
                break;
            }
            const filePath = resolvePath(args[0]);
            try {
                const response = await fetch(`${API_BASE_URL}/api/vfs/file?path=${encodeURIComponent(filePath)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (response.ok) {
                    writeOutput(`--- Content of ${filePath} ---`);
                    writeOutput(data.content);
                    writeOutput(`--- End of file ---`);
                } else {
                    writeOutput(`Error: ${data.message}`, 'error');
                    addNotification(`cat failed: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error('Error fetching file content for cat:', error);
                addNotification('Failed to connect to server or read file.', 'error');
            }
            break;
        }

        case 'cp': { // Copy file/folder
            if (args.length < 2) {
                writeOutput('Usage: cp <source> <destination>');
                break;
            }
            const sourcePath = resolvePath(args[0]);
            const destinationPath = resolvePath(args[1]);
            const response = await fetch(`${API_BASE_URL}/api/vfs/copy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ sourcePath, destinationPath }),
            });
            const data = await response.json();
            if (response.ok) {
                writeOutput(data.message);
                addNotification(`Copied ${path.basename(sourcePath)}`, 'success');
            } else {
                writeOutput(`Error: ${data.message}`, 'error');
                addNotification(`cp failed: ${data.message}`, 'error');
            }
            break;
        }

        case 'mv': { // Move/rename file/folder
            if (args.length < 2) {
                writeOutput('Usage: mv <source> <destination>');
                break;
            }
            const sourcePath = resolvePath(args[0]);
            const destinationPath = resolvePath(args[1]);
            const response = await fetch(`${API_BASE_URL}/api/vfs/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ sourcePath, destinationPath }),
            });
            const data = await response.json();
            if (response.ok) {
                writeOutput(data.message);
                addNotification(`Moved/Renamed ${path.basename(sourcePath)}`, 'success');
            } else {
                writeOutput(`Error: ${data.message}`, 'error');
                addNotification(`mv failed: ${data.message}`, 'error');
            }
            break;
        }

        case 'rm': { // Remove file or empty directory
            if (args.length === 0) {
                writeOutput('Usage: rm <file>');
                writeOutput('  or: rm -r <directory> (for recursive)');
                break;
            }
            const isRecursive = args[0] === '-r';
            const targetPath = isRecursive ? resolvePath(args[1]) : resolvePath(args[0]);

            const endpoint = isRecursive ? '/api/vfs/delete-recursive' : '/api/vfs/delete';
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ path: targetPath }),
            });
            const data = await response.json();
            if (response.ok) {
                writeOutput(data.message);
                addNotification(`Removed ${path.basename(targetPath)}`, 'success');
            } else {
                writeOutput(`Error: ${data.message}`, 'error');
                addNotification(`rm failed: ${data.message}`, 'error');
            }
            break;
        }

        case 'rmdir': { // Remove empty directory (alias for rm without -r)
            if (args.length === 0) {
                writeOutput('Usage: rmdir <directory>');
                break;
            }
            const targetPath = resolvePath(args[0]);
            const response = await fetch(`${API_BASE_URL}/api/vfs/delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ path: targetPath }),
            });
            const data = await response.json();
            if (response.ok) {
                writeOutput(data.message);
                addNotification(`Removed directory ${path.basename(targetPath)}`, 'success');
            } else {
                writeOutput(`Error: ${data.message}`, 'error');
                addNotification(`rmdir failed: ${data.message}`, 'error');
            }
            break;
        }

        case 'pkgm': {
            const pkgCmd = args[0];
            if (!pkgCmd) {
                writeOutput('Usage: pkgm <command> [args]');
                writeOutput('  Commands: install, list-installed, uninstall');
                break;
            }

            switch (pkgCmd) {
                case 'install': {
                    if (args.length < 2) {
                        writeOutput('Usage: pkgm install <path/to/package.pakapp>');
                        break;
                    }
                    const packagePath = resolvePath(args[1]);
                    const response = await fetch(`${API_BASE_URL}/api/apps/install`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ packagePath }),
                    });
                    const data = await response.json();
                    if (response.ok) {
                        writeOutput(data.message);
                        addNotification(data.message, 'success');
                        updateInstalledApps(); // Trigger re-fetch of installed apps in App.js
                        writeOutput('\n*** IMPORTANT: For the new app to appear, you must RESTART your frontend development server (Ctrl+C then npm start). ***', 'warning');
                    } else {
                        writeOutput(`Error: ${data.message}`, 'error');
                        addNotification(`pkgm install failed: ${data.message}`, 'error');
                    }
                    break;
                }
                case 'list-installed': {
                    const response = await fetch(`${API_BASE_URL}/api/apps/installed`, {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    const data = await response.json();
                    if (response.ok) {
                        if (data.length === 0) {
                            writeOutput('No applications installed.');
                        } else {
                            writeOutput('Installed Applications:');
                            data.forEach(app => writeOutput(`  - ${app.title} (ID: ${app.appId})`));
                        }
                    } else {
                        writeOutput(`Error: ${data.message}`, 'error');
                        addNotification(`pkgm list failed: ${data.message}`, 'error');
                    }
                    break;
                }
                case 'uninstall': {
                    if (args.length < 2) {
                        writeOutput('Usage: pkgm uninstall <app_id>');
                        break;
                    }
                    const appIdToUninstall = args[1];
                    const response = await fetch(`${API_BASE_URL}/api/apps/uninstall`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ appId: appIdToUninstall }),
                    });
                    const data = await response.json();
                    if (response.ok) {
                        writeOutput(data.message);
                        addNotification(data.message, 'success');
                        updateInstalledApps();
                        writeOutput('\n*** IMPORTANT: For changes to take full effect, you must RESTART your frontend development server (Ctrl+C then npm start). ***', 'warning');
                    } else {
                        writeOutput(`Error: ${data.message}`, 'error');
                        addNotification(`pkgm uninstall failed: ${data.message}`, 'error');
                    }
                    break;
                }
                default:
                    writeOutput(`Unknown pkgm command: ${pkgCmd}. Use "pkgm help".`, 'error');
            }
            break;
        }

        case 'clear':
          clearOutput();
          break;

        default:
          writeOutput(`Unknown command: ${cmd}. Type 'help' for available commands.`, 'error');
      }
    } catch (error) {
      writeOutput(`Error executing command: ${error.message}`, 'error');
    }
  };

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (command.trim() === '') return;
    
    executeCommand(command.trim());
    setCommand('');
  };

  // Handle command history navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex.current > 0) {
        historyIndex.current -= 1;
        setCommand(commandHistory.current[historyIndex.current]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex.current < commandHistory.current.length - 1) {
        historyIndex.current += 1;
        setCommand(commandHistory.current[historyIndex.current]);
      } else {
        historyIndex.current = commandHistory.current.length;
        setCommand('');
      }
    }
  };

  return (
    <div className="terminal-app h-full flex flex-col bg-black text-green-400 font-mono p-2">
      <div className="terminal-output flex-grow overflow-y-auto" ref={outputRef}>
        {output.length === 0 && (
          <div className="terminal-placeholder opacity-50">
            Welcome to the Terminal App! Type 'help' for a list of commands.
          </div>
        )}
        {output.map((line, index) => (
          <div key={index} className={`terminal-line ${line.type}`}>
            {line.timestamp} - {line.text}
          </div>
        ))}
      </div>
      <form className="terminal-input-form mt-2 flex items-center" onSubmit={handleCommandSubmit}>
        <div className="terminal-prompt mr-2">{cwd}$</div>
        <input
          type="text"
          className="terminal-input flex-grow bg-transparent border-none outline-none"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </form>
    </div>
  );
};

export default TerminalApp;