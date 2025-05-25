// frontend/src/components/Taskbar.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Corrected path relative to Taskbar.js
import AppsMenu from './AppsMenu'; // New: AppsMenu Component

const Taskbar = ({ onLaunchApp, openWindows, onWindowFocus }) => {
  const { userId, logout, installedApps } = useAuth(); // Get installedApps
  const [showAppsMenu, setShowAppsMenu] = useState(false);

  const toggleAppsMenu = () => {
    setShowAppsMenu(prev => !prev);
  };

  const handleLaunchFromMenu = (appId, appTitle) => {
    onLaunchApp(appId, appTitle);
    setShowAppsMenu(false); // Close menu after launching
  };

  return (
    <div className="w-full bg-gray-900 p-3 flex justify-between items-center shadow-lg border-t border-gray-700 relative z-30">
      <div className="flex space-x-4">
        {/* Apps Menu Button */}
        <button
          onClick={toggleAppsMenu}
          className="p-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          Apps
        </button>
        {/* Direct Launch Buttons (optional, can be removed if Apps Menu is primary) */}
        <button
          onClick={() => onLaunchApp('file-explorer-app', 'File Explorer')}
          className="p-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Files
        </button>
        <button
          onClick={() => onLaunchApp('terminal-app', 'Terminal')}
          className="p-2 rounded-md bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Terminal
        </button>
      </div>

      {/* Apps Menu */}
      {showAppsMenu && (
        <AppsMenu
          installedApps={installedApps}
          onLaunchApp={handleLaunchFromMenu}
          onClose={() => setShowAppsMenu(false)}
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
          onClick={logout}
          className="p-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Taskbar;