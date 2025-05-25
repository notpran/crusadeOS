// frontend/src/App.js
import React, { useState } from 'react'; // Removed unused useEffect, useRef, useCallback imports
import { useAuth } from './context/AuthContext';
import LoginScreen from './components/LoginScreen';
import Desktop from './components/Desktop';
import Taskbar from './components/Taskbar';
import Window from './components/Window'; // Window is used in Desktop rendering, so keep it
import FileExplorer from './apps/FileExplorer';
import TextEditor from './apps/TextEditor';
import HelloWorldApp from './apps/HelloWorldApp';
import TerminalApp from './apps/TerminalApp';

// --- Main App Component ---
export default function App() {
  const { isAuthenticated, isAuthReady, logout, token, installedApps, updateInstalledApps } = useAuth();
  const [openWindows, setOpenWindows] = useState([]);

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-lg">Loading OS...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const launchApp = (appId, appTitle, appContentProps = {}) => {
    const existingWindow = openWindows.find(win => win.appId === appId && !win.minimized);
    if (existingWindow) {
      focusWindow(existingWindow.id);
      return;
    }

    const newWindowId = crypto.randomUUID(); // Now using crypto.randomUUID() for uniqueness
    
    let content;
    let initialWidth = 800;
    let initialHeight = 600;

    // Map appId from manifest to actual React component
    switch (appId) {
      case 'hello-world-app':
        content = <HelloWorldApp />;
        initialWidth = 400;
        initialHeight = 300;
        break;
      case 'file-explorer-app':
        content = <FileExplorer onOpenFile={openFileInEditor} token={token} />;
        initialWidth = 800;
        initialHeight = 600;
        break;
      case 'text-editor-app':
        // The TextEditor content depends on the file being opened
        content = <TextEditor {...appContentProps} token={token} />;
        initialWidth = 700;
        initialHeight = 500;
        break;
      case 'terminal-app': // New case for Terminal App
        content = <TerminalApp token={token} updateInstalledApps={updateInstalledApps} />;
        initialWidth = 900;
        initialHeight = 600;
        break;
      default:
        content = <p className="text-red-400">Application not found or supported.</p>;
        initialWidth = 400;
        initialHeight = 200;
        appTitle = "Error"; // Override title for error case
    }

    setOpenWindows(prev => {
      // Calculate staggering based on the current number of open windows,
      // to avoid 'nextWindowId' which no longer exists.
      const staggerOffset = (prev.length * 20) % 200; 
      return [
        ...prev.map(win => ({ ...win, focused: false })), // unfocus all other windows
        {
          id: newWindowId,
          appId: appId,
          title: appTitle,
          content: content,
          x: 150 + staggerOffset, // Use calculated stagger
          y: 150 + staggerOffset, // Use calculated stagger
          width: initialWidth,
          height: initialHeight,
          focused: true,
          minimized: false,
          maximized: false,
          fullFilePath: appContentProps.filePath || null, // Store file path for editor instances
        }
      ];
    });
  };

  const openFileInEditor = async (fileName, currentExplorerPath) => {
    // FIX: Removed unnecessary span tags and escape characters in string interpolation
    const fullFilePath = currentExplorerPath === '/' ? `/${fileName}` : `${currentExplorerPath}/${fileName}`;

    const existingEditorWindow = openWindows.find(win =>
      win.appId === 'text-editor-app' && win.fullFilePath === fullFilePath
    );
    if (existingEditorWindow) {
      focusWindow(existingEditorWindow.id);
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/vfs/file?path=${encodeURIComponent(fullFilePath)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch file content.');
      }

      const contentToEdit = data.content;
      launchApp('text-editor-app', `Editing: ${fileName}`, { filePath: fullFilePath, fileName: fileName, initialContent: contentToEdit });

    } catch (error) {
      console.error("Error opening file for editing:", error);
      alert(`Could not open file: ${error.message}`);
    }
  };


  const closeWindow = (id) => {
    setOpenWindows(prev => prev.filter(win => win.id !== id));
  };

  const minimizeWindow = (id) => {
    setOpenWindows(prev =>
      prev.map(win => (win.id === id ? { ...win, minimized: !win.minimized, focused: false } : win))
    );
  };

  const maximizeWindow = (id) => {
    setOpenWindows(prev =>
      prev.map(win => (win.id === id ? { ...win, maximized: !win.maximized, x:0, y:0, width:'100%', height:'100%' } : win))
    );
  };

  const focusWindow = (id) => {
    setOpenWindows(prev => {
      const windowToFocus = prev.find(win => win.id === id);
      if (!windowToFocus) return prev;

      const updatedWindows = prev.filter(win => win.id !== id).map(win => ({ ...win, focused: false }));
      return [...updatedWindows, { ...windowToFocus, focused: true, minimized: false }];
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen font-inter bg-gray-900 text-white">
      <Desktop
        openWindows={openWindows}
        onWindowClose={closeWindow}
        onWindowMinimize={minimizeWindow}
        onWindowMaximize={maximizeWindow}
        onWindowFocus={focusWindow}
      />
      <Taskbar
        onLaunchApp={launchApp}
        openWindows={openWindows}
        onWindowFocus={focusWindow}
        onLogout={logout}
        installedApps={installedApps} // Pass installedApps to Taskbar
      />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"></link>
    </div>
  );
}