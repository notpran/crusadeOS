// frontend/src/components/AppsMenu.js

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from './NotificationSystem';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const AppsMenu = ({ installedApps, onLaunchApp, onClose }) => {
  const { token, updateInstalledApps } = useAuth();
  const { addNotification } = useNotifications();

  const handleUninstall = async (appId, appTitle) => {
    const confirmUninstall = window.confirm(`Are you sure you want to uninstall "${appTitle}"? This will require a frontend restart.`);
    if (!confirmUninstall) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/apps/uninstall`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ appId }),
      });
      const data = await response.json();
      if (response.ok) {
        addNotification(data.message, 'success');
        updateInstalledApps();
        onClose();
      } else {
        addNotification(data.message || `Failed to uninstall ${appTitle}.`, 'error');
      }
    } catch (error) {
      console.error('Error uninstalling app:', error);
      addNotification(`Failed to connect to server or uninstall ${appTitle}.`, 'error');
    }
  };

  // --- Drag and Drop Handler for Apps Menu Items ---
  const handleDragStart = (e, appId) => {
    e.dataTransfer.setData('appId', appId); // Set the app ID as data
    e.dataTransfer.effectAllowed = 'copy'; // Visual effect for copy
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
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-800 rounded-lg shadow-xl py-2 z-40 border border-gray-700">
      <h3 className="text-white text-lg font-semibold mb-2 px-4">Installed Apps</h3>
      {installedApps.length === 0 ? (
        <p className="text-gray-400 text-sm px-4 py-1">No apps installed. On first run, default apps are installed. Restart frontend if empty!</p>
      ) : (
        <ul>
          {installedApps.map(app => (
            <li
              key={app.appId}
              className="flex items-center justify-between group"
              draggable="true" // Make the list item draggable
              onDragStart={(e) => handleDragStart(e, app.appId)} // Handle drag start
            >
              <button
                onClick={() => onLaunchApp(app.appId, app.title)}
                className="flex-grow text-left px-4 py-2 rounded-md hover:bg-blue-600 hover:text-white transition-colors flex items-center space-x-3"
              >
                <span className="text-xl">
                  {getAppIcon(app.appId)}
                </span>
                <span className="text-white text-base">{app.title}</span>
              </button>
              {/* Uninstall Button */}
              {!app.isCore && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleUninstall(app.appId, app.title); }}
                  className="mr-2 px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title={`Uninstall ${app.title}`}
                >
                  Uninstall
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={onClose}
        className="w-full mt-3 p-2 rounded-b-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
      >
        Close Menu
      </button>
    </div>
  );
};

export default AppsMenu;