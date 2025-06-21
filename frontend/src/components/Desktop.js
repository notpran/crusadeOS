import React from 'react';
import Window from './Window'; // Assuming Window.js is in the same folder

const Desktop = ({ openWindows, onWindowClose, onWindowMinimize, onWindowMaximize, onWindowFocus, backgroundColor }) => {
  return (
    <div
      className="flex-grow relative overflow-hidden"
      style={{ backgroundColor }}
    >
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
          minimized={win.minimized}
          maximized={win.maximized}
        >
          {win.content}
        </Window>
      ))}
    </div>
  );
};

export default Desktop;