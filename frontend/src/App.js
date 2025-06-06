// frontend/src/App.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './components/NotificationSystem';
import LoginScreen from './components/LoginScreen';
import Desktop from './components/Desktop';
import Taskbar from './components/Taskbar'
import Window from './components/Window';
import FileExplorer from './apps/FileExplorer';
import TextEditor from './apps/TextEditor';
import HelloWorldApp from './apps/HelloWorldApp';
import TerminalApp from './apps/TerminalApp';
import CalculatorApp from './apps/CalculatorApp';
import AboutApp from './apps/AboutApp';
import ImageViewerApp from './apps/ImageViewerApp';
import SettingsApp from './apps/SettingsApp';
import ContextMenu from './components/ContextMenu';

// Define the API_BASE_URL for all fetch calls
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Window size constants
const DEFAULT_WINDOW_WIDTH = 800;
const DEFAULT_WINDOW_HEIGHT = 800;
const TASKBAR_HEIGHT = 40;

// Map app IDs to their React components
const appComponents = {
    'file-explorer-app': FileExplorer,
    'hello-world-app': HelloWorldApp,
    'text-editor-app': TextEditor,
    'terminal-app': TerminalApp,
    'calculator-app': CalculatorApp,
    'about-os-app': AboutApp,
    'image-viewer-app': ImageViewerApp,
    'settings-app': SettingsApp,
};

// --- Main App Component (Wrapped by NotificationProvider) ---
function MainAppContent() {
  // Auth and notification hooks
  const { 
    isAuthenticated, 
    isAuthReady, 
    logout, 
    token, 
    installedApps,
    pinnedApps,
    updatePinnedApps,
    userSettings
  } = useAuth();
  const { addNotification } = useNotifications();

  // State
  const [openWindows, setOpenWindows] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({
    desktopBackgroundColor: '#1a202c',
    desktopBackgroundImage: '',
  });
  const [contextMenu, setContextMenu] = useState(null);

  // Refs for circular dependencies
  const openFileInEditorRef = useRef(null);
  const launchAppRef = useRef(null);

  // Window management callbacks
  const closeWindow = useCallback((id) => {
    setOpenWindows(prev => prev.filter(win => win.id !== id));
  }, []);

  const focusWindow = useCallback((id) => {
    setOpenWindows(prev => {
      const windowToFocus = prev.find(win => win.id === id);
      if (!windowToFocus) return prev;
      return [
        ...prev.filter(win => win.id !== id).map(win => ({ ...win, focused: false })),
        { 
          ...windowToFocus, 
          focused: true, 
          minimized: false // Always restore when focusing
        }
      ];
    });
  }, []);

  const maximizeWindow = useCallback((id) => {
    setOpenWindows(prev => prev.map(win => {
      if (win.id === id) {
        if (win.maximized) {
          // Restore previous state
          return {
            ...win,
            maximized: false,
            x: win.prevX ?? 150,
            y: win.prevY ?? 150,
            width: win.prevWidth ?? DEFAULT_WINDOW_WIDTH,
            height: win.prevHeight ?? DEFAULT_WINDOW_HEIGHT,
            focused: true
          };
        } else {
          // Save current state and maximize
          return {
            ...win,
            maximized: true,
            prevX: win.x,
            prevY: win.y,
            prevWidth: win.width,
            prevHeight: win.height,
            x: 0,
            y: 0,
            width: window.innerWidth,
            height: window.innerHeight - TASKBAR_HEIGHT,
            focused: true
          };
        }
      }
      return { ...win, focused: false };
    }));
  }, []);

  const minimizeWindow = useCallback((id) => {
    setOpenWindows(prev => prev.map(win => {
      if (win.id === id) {
        return {
          ...win,
          minimized: true,
          focused: false,
          // Save state for restoration
          prevX: win.x,
          prevY: win.y,
          prevWidth: win.width,
          prevHeight: win.height,
          prevMaximized: win.maximized
        };
      }
      return {
        ...win,
        focused: !win.minimized // Focus the next unminimized window
      };
    }));
  }, []);

  // File handling callback
  const openFileInEditor = useCallback(async (filePath, currentPath) => {
    const fileName = filePath.split('/').pop();
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const fullFilePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
    
    let appToLaunch;
    let appTitlePrefix;
    let contentToPass = {};

    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].includes(fileExtension)) {
      appToLaunch = 'image-viewer-app';
      appTitlePrefix = 'Viewing';
      contentToPass.filePath = fullFilePath;
    } else {
      appToLaunch = 'text-editor-app';
      appTitlePrefix = 'Editing';
      try {
        const response = await fetch(`${API_BASE_URL}/api/cvfs/file?path=${encodeURIComponent(fullFilePath)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch text content for ${fileName}.`);
        }
        const data = await response.json();
        contentToPass.initialContent = data.content;
      } catch (error) {
        console.error("Error fetching text file content:", error);
        addNotification(`Could not open text file: ${error.message}`, 'error');
        return;
      }
    }

    launchAppRef.current(appToLaunch, `${appTitlePrefix}: ${fileName}`, { 
      filePath: fullFilePath, 
      fileName: fileName, 
      ...contentToPass
    });
  }, [token, addNotification]);

  // App launching callback
  const launchApp = useCallback((appId, title, options = {}) => {
    const existingWindow = openWindows.find(win => win.appId === appId && !win.minimized);
    if (existingWindow) {
      focusWindow(existingWindow.id);
      addNotification(`"${title}" is already open.`, 'info');
      return;
    }

    const appDefinition = installedApps.find(app => app.appId === appId);
    if (!appDefinition) {
      addNotification(`App "${title}" not found or not installed.`, 'error');
      return;
    }

    const AppComponent = appComponents[appDefinition.appId];
    if (!AppComponent) {
      addNotification(`Component for "${title}" not loaded.`, 'error');
      return;
    }

    const newWindowId = crypto.randomUUID();

    // Calculate centered position with default window size
    const x = Math.floor((window.innerWidth - DEFAULT_WINDOW_WIDTH) / 2);
    const y = Math.floor((window.innerHeight - DEFAULT_WINDOW_HEIGHT) / 2);

    // Pass required props to app components
    const appProps = {
      ...options,
      token,
      addNotification,
      onOpenFile: appId === 'file-explorer-app' ? openFileInEditorRef.current : undefined
    };

    setOpenWindows(prev => [
      ...prev.map(win => ({ ...win, focused: false })),
      {
        id: newWindowId,
        appId,
        title,
        content: <AppComponent key={newWindowId} {...appProps} />,
        x: x,
        y: y,
        focused: true,
        minimized: false,
        maximized: false
      }
    ]);

    addNotification(`Launched ${title}`, 'success');
  }, [openWindows, installedApps, token, addNotification, focusWindow]);

  // Update refs
  useEffect(() => {
    openFileInEditorRef.current = openFileInEditor;
    launchAppRef.current = launchApp;
  }, [openFileInEditor, launchApp]);

  // Context menu handlers
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDesktopRightClick = useCallback((e) => {
    e.preventDefault();
    
    const menuItems = [
      { 
        label: 'New Folder',
        action: () => {
          launchApp('file-explorer-app', 'File Explorer');
        }
      },
      { 
        label: 'New File',
        action: () => {
          launchApp('file-explorer-app', 'File Explorer');
        }
      },
      { 
        label: 'Settings',
        action: () => {
          launchApp('settings-app', 'Settings');
        }
      },
      { 
        label: 'About CrusadeOS',
        action: () => {
          launchApp('about-os-app', 'About CrusadeOS');
        }
      }
    ];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: menuItems.map(item => ({
        label: item.label,
        onClick: () => {
          item.action();
          closeContextMenu();
        }
      }))
    });
  }, [launchApp, closeContextMenu]);

  // Settings effect
  useEffect(() => {
    if (userSettings) {
      const newBackgroundColor = userSettings.desktopBackgroundColor || '#1a202c';
      const newBackgroundImage = userSettings.desktopBackgroundImage || '';
      
      setGlobalSettings(prev => {
        if (prev.desktopBackgroundColor !== newBackgroundColor ||
            prev.desktopBackgroundImage !== newBackgroundImage) {
          return {
            ...prev,
            desktopBackgroundColor: newBackgroundColor,
            desktopBackgroundImage: newBackgroundImage,
          };
        }
        return prev;
      });
    }
  }, [userSettings]);

  // Loading and auth states
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

  // Main UI render
  return (
    <div 
      className="flex flex-col h-screen w-screen font-inter text-white transition-all duration-300"
      style={{
        backgroundColor: globalSettings.desktopBackgroundColor,
        backgroundImage: globalSettings.desktopBackgroundImage ? `url(${globalSettings.desktopBackgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      onContextMenu={handleDesktopRightClick}
      onClick={closeContextMenu}
    >
      <Desktop
        openWindows={openWindows}
        onWindowClose={closeWindow}
        onWindowMinimize={minimizeWindow}
        onWindowMaximize={maximizeWindow}
        onWindowFocus={focusWindow}
        backgroundColor={globalSettings.desktopBackgroundColor}
      />
      <Taskbar
        onLaunchApp={launchApp}
        openWindows={openWindows}
        onWindowFocus={focusWindow}
        onLogout={logout}
        installedApps={installedApps}
        pinnedApps={pinnedApps}
        updatePinnedApps={updatePinnedApps}
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

export default function AppWrapper() {
  return (
    <NotificationProvider>
      <MainAppContent />
    </NotificationProvider>
  );
}