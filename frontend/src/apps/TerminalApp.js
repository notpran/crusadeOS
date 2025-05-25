// frontend/src/apps/TerminalApp.js
import React, { useState, useRef, useEffect, useCallback } from 'react';

const TerminalApp = ({ token, updateInstalledApps }) => {
  const [output, setOutput] = useState([]);
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('/'); // Current Working Directory
  const outputRef = useRef(null);

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

  // Helper to resolve paths like 'cd ..' or 'ls ./myfolder'
  const resolvePath = useCallback((inputPath) => {
    let absolutePath;
    if (inputPath.startsWith('/')) {
        absolutePath = inputPath; // Already absolute
    } else if (inputPath === '.' || inputPath === './') {
        absolutePath = cwd; // Current directory
    } else if (inputPath === '..') {
        const parts = cwd.split('/').filter(Boolean);
        parts.pop(); // Remove last part
        absolutePath = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    } else {
        // Relative path
        absolutePath = cwd === '/' ? `/${inputPath}` : `<span class="math-inline">\{cwd\}/</span>{inputPath}`;
    }
    // Normalize path to remove redundant slashes (e.g., //, /./)
    return path.normalize(absolutePath);
  }, [cwd]);

  // Path normalization helper for frontend
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
    }
  };


  const executeCommand = async (fullCommand) => {
    writeOutput(`> ${fullCommand}`, 'command');
    const [cmd, ...args] = fullCommand.trim().split(/\s+/); // Split by one or more spaces

    try {
      switch (cmd) {
        case 'help':
          writeOutput('Available commands:');
          writeOutput('  ls [path] - List directory contents.');
          writeOutput('  cd <path> - Change current directory.');
          writeOutput('  mkdir <name> - Create a new directory.');
          writeOutput('  cf <name> - Create an empty file.');
          writeOutput('  pkgm install <path/to/package.pakapp> - Install a new application.');
          writeOutput('  pkgm list-installed - List installed applications.');
          writeOutput('  pkgm uninstall <app_id> - Uninstall an application.');
          writeOutput('  clear - Clear terminal output.');
          break;

        case 'ls': {
          const targetPath = args[0] ? resolvePath(args[0]) : cwd;
          const response = await fetch(`http://localhost:5000/api/vfs/list?path=${encodeURIComponent(targetPath)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok) {
            if (data.length === 0) {
              writeOutput(`Directory '${targetPath}' is empty.`);
            } else {
              data.forEach(item => {
                writeOutput(`${item.type === 'folder' ? '📁' : '📄'} ${item.name}`);
              });
            }
          } else {
            writeOutput(`Error: ${data.message}`, 'error');
          }
          break;
        }

        case 'cd': {
            if (args.length === 0) {
                writeOutput('Usage: cd <path>');
                break;
            }
            const targetPath = resolvePath(args[0]);
            // Before changing CWD, verify the path exists and is a directory
            const response = await fetch(`http://localhost:5000/api/vfs/list?path=${encodeURIComponent(targetPath)}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setCwd(targetPath);
                writeOutput(`Changed directory to ${targetPath}`);
            } else {
                const data = await response.json();
                writeOutput(`Error: ${data.message || 'Directory not found or not a directory.'}`, 'error');
            }
            break;
        }

        case 'mkdir': {
          if (args.length === 0) {
            writeOutput('Usage: mkdir <name>');
            break;
          }
          const dirName = args[0];
          const response = await fetch('http://localhost:5000/api/vfs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ path: cwd, name: dirName, type: 'folder' }),
          });
          const data = await response.json();
          if (response.ok) {
            writeOutput(data.message);
          } else {
            writeOutput(`Error: ${data.message}`, 'error');
          }
          break;
        }

        case 'cf': { // Create File
          if (args.length === 0) {
            writeOutput('Usage: cf <name>');
            break;
          }
          const fileName = args[0];
          const response = await fetch('http://localhost:5000/api/vfs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ path: cwd, name: fileName, type: 'file' }),
          });
          const data = await response.json();
          if (response.ok) {
            writeOutput(data.message);
          } else {
            writeOutput(`Error: ${data.message}`, 'error');
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
                    const response = await fetch('http://localhost:5000/api/apps/install', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ packagePath }),
                    });
                    const data = await response.json();
                    if (response.ok) {
                        writeOutput(data.message);
                        updateInstalledApps(); // Trigger re-fetch of installed apps in App.js
                    } else {
                        writeOutput(`Error: ${data.message}`, 'error');
                    }
                    break;
                }
                case 'list-installed': {
                    const response = await fetch('http://localhost:5000/api/apps/installed', {
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
                    }
                    break;
                }
                case 'uninstall': {
                    if (args.length < 2) {
                        writeOutput('Usage: pkgm uninstall <app_id>');
                        break;
                    }
                    const appIdToUninstall = args[1];
                    const response = await fetch('http://localhost:5000/api/apps/uninstall', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ appId: appIdToUninstall }),
                    });
                    const data = await response.json();
                    if (response.ok) {
                        writeOutput(data.message);
                        updateInstalledApps(); // Trigger re-fetch of installed apps in App.js
                    } else {
                        writeOutput(`Error: ${data.message}`, 'error');
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
          writeOutput(`Unknown command: ${cmd}. Type 'help' for a list of commands.`, 'error');
      }
    } catch (error) {
      console.error('Terminal command execution error:', error);
      writeOutput(`An internal error occurred: ${error.message}`, 'error');
    }
  };

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (command.trim() === '') return;
    executeCommand(command);
    setCommand('');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-200 font-mono text-sm">
      <div className="flex-grow p-4 overflow-y-auto custom-scrollbar" ref={outputRef}>
        {output.map((line, index) => (
          <p key={index} className={
            line.type === 'error' ? 'text-red-400' :
            line.type === 'command' ? 'text-blue-400' :
            'text-gray-200'
          }>
            <span className="text-gray-500 mr-2">[{line.timestamp}]</span>{line.text}
          </p>
        ))}
      </div>
      <form onSubmit={handleCommandSubmit} className="p-4 border-t border-gray-700 flex items-center">
        <span className="text-green-400 mr-2">{cwd}</span>
        <input
          type="text"
          className="flex-grow bg-transparent border-none outline-none text-white placeholder-gray-500 font-mono"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          autoFocus
          placeholder="Type 'help' for commands..."
        />
      </form>
      {/* Basic custom scrollbar styling for Tailwind context */}
      <style>{`
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #2d3748; /* gray-800 */
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #4a5568; /* gray-600 */
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #5a657a; /* gray-500 */
      }
      `}</style>
    </div>
  );
};

export default TerminalApp;