// frontend/src/components/Taskbar.js

import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from './NotificationSystem';
import AppsMenu from './AppsMenu';
import ContextMenu from './ContextMenu'; // Import ContextMenu

const Taskbar = ({ onLaunchApp, openWindows, onWindowFocus, pinnedApps, updatePinnedApps, installedApps }) => {
  const { userId, logout } = useAuth();
  const { addNotification } = useNotifications();
  const [showAppsMenu, setShowAppsMenu] = useState(false);
  const taskbarRef = useRef(null); // Ref for drag & drop target

  // State for Taskbar context menu (for unpinning)
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, items: [], appId: null });


  const toggleAppsMenu = () => {
    setShowAppsMenu(prev => !prev);
  };

  const handleLaunchFromMenu = (appId, appTitle) => {
    onLaunchApp(appId, appTitle);
    setShowAppsMenu(false);
  };

  const handleLogout = async () => {
    await logout();
    addNotification('Logged out successfully!', 'info');
  };

  // --- Drag and Drop Handlers ---

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'copy'; // Visual feedback for allowed drop
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData('appId'); // Get the appId from the drag data
    if (appId) {
      // Check if already pinned
      if (pinnedApps.includes(appId)) {
        addNotification(`App is already pinned to the Taskbar.`, 'info');
        return;
      }
      // Check if it's a valid installed app
      const appToPin = installedApps.find(app => app.appId === appId);
      if (!appToPin) {
          addNotification(`Could not pin app: App not found or not installed.`, 'error');
          return;
      }

      const newPinnedApps = [...pinnedApps, appId];
      updatePinnedApps(newPinnedApps); // Update context and persist
      addNotification(`"${appToPin.title}" pinned to Taskbar.`, 'success');
    }
  };

  // --- Context Menu for Pinned Apps ---
  const openPinnedAppContextMenu = (event, appId) => {
    event.preventDefault(); // Prevent default browser context menu
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      appId, // Store the app ID in the context menu state
      items: [
        {
          label: 'Unpin from Taskbar',
          action: () => handleUnpinApp(appId),
        },
      ],
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, items: [], appId: null });
  };

  const handleUnpinApp = (appId) => {
    const newPinnedApps = pinnedApps.filter(id => id !== appId);
    updatePinnedApps(newPinnedApps);
    const unpinnedApp = installedApps.find(app => app.appId === appId);
    addNotification(`"${unpinnedApp?.title || appId}" unpinned.`, 'info');
    closeContextMenu();
  };

  // Function to get icon/emoji for apps
  const getAppIcon = (appId) => {
    switch (appId) {
      case 'file-explorer-app': return '📁';
      case 'text-editor-app': return '📝';
      case 'terminal-app': return '💻';
      case 'calculator-app': return '🧮';
      case 'about-os-app': return 'ℹ️';
      case 'image-viewer-app': return '🖼️';
      case 'settings-app': return '⚙️';
      default: return '✨';
    }
  };

  return (
    <div
      ref={taskbarRef}
      onDragOver={handleDragOver} // Allow drops
      onDrop={handleDrop}       // Handle drops
      onClick={closeContextMenu} // Close context menu if clicked outside
      className="w-full bg-gray-900 p-3 flex justify-between items-center shadow-lg border-t border-gray-700 relative z-30"
    >
      <div className="flex space-x-4">
        {/* Apps Menu Button */}
        <button
          onClick={toggleAppsMenu}
          className="p-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          Apps
        </button>

        {/* Pinned Apps */}
        {pinnedApps.map(appId => {
          const app = installedApps.find(a => a.appId === appId);
          if (!app) return null; // Don't render if app isn't installed

          return (
            <button
              key={app.appId}
              onClick={() => onLaunchApp(app.appId, app.title)}
              onContextMenu={(e) => openPinnedAppContextMenu(e, app.appId)}
              className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={app.title}
            >
              {getAppIcon(app.appId)}
            </button>
          );
        })}
      </div>

      {/* Apps Menu */}
      {showAppsMenu && (
        <AppsMenu
          installedApps={installedApps}
          onLaunchApp={handleLaunchFromMenu}
          onClose={() => setShowAppsMenu(false)}
        />
      )}

      {/* Context Menu for Pinned Apps */}
      {contextMenu.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}

      <div className="flex items-center space-x-4">
        {/* Open Windows (Taskbar items) */}
        {openWindows.map((win) => (
          <button
            key={win.id}
            onClick={() => onWindowFocus(win.id)}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              win.focused ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {win.title}
          </button>
        ))}
        {userId && (
            <span className="text-gray-400 text-xs hidden sm:block">User: {userId.substring(0, 8)}...</span>
        )}
        <button
          onClick={handleLogout}
          className="p-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Taskbar;