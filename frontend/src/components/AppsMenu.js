// frontend/src/components/AppsMenu.js
import React from 'react';

const AppsMenu = ({ installedApps, onLaunchApp, onClose }) => {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-2 z-40">
      <h3 className="text-white text-lg font-semibold mb-2 px-2">Installed Apps</h3>
      {installedApps.length === 0 ? (
        <p className="text-gray-400 text-sm px-2 py-1">No apps installed. Use the Terminal to install apps!</p>
      ) : (
        <ul>
          {installedApps.map(app => (
            <li key={app.appId}>
              <button
                onClick={() => onLaunchApp(app.appId, app.title)}
                className="w-full text-left p-2 rounded-md hover:bg-blue-600 hover:text-white transition-colors flex items-center space-x-2"
              >
                {/* You can add icons here based on app.appId */}
                <span className="text-xl">{
                  app.appId === 'file-explorer-app' ? '📁' :
                  app.appId === 'text-editor-app' ? '📝' :
                  app.appId === 'terminal-app' ? '💻' :
                  '✨' // Default icon
                }</span>
                <span className="text-white text-sm">{app.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={onClose}
        className="w-full mt-2 p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
      >
        Close Menu
      </button>
    </div>
  );
};

export default AppsMenu;