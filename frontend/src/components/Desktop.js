import React from 'react';
import Window from './Window'; // Assuming Window.js is in the same folder

const Desktop = ({ openWindows, onWindowClose, onWindowMinimize, onWindowMaximize, onWindowFocus }) => {
  return (
    <div className="flex-grow bg-gradient-to-br from-gray-800 to-gray-950 relative overflow-hidden">
      {/* Render open windows */}
      {openWindows.filter(win => !win.minimized).map((win) => ( // Only show non-minimized windows
        <Window
          key={win.id}
          id={win.id}
          title={win.title}
          initialX={win.x}
          initialY={win.y}
          initialWidth={win.width}
          initialHeight={win.height}
          onClose={onWindowClose}
          onMinimize={onWindowMinimize}
          onMaximize={onWindowMaximize}
          focused={win.focused}
          onFocus={onWindowFocus}
        >
          {win.content}
        </Window>
      ))}
    </div>
  );
};

export default Desktop;