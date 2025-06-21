import React, { useState, useEffect, useRef } from 'react';

const Window = ({ id, title, children, onClose, onMinimize, onMaximize, initialX, initialY, initialWidth, initialHeight, focused, onFocus }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ 
    x: initialX !== undefined ? initialX : 100, 
    y: initialY !== undefined ? initialY : 100 
  });
  const [size, setSize] = useState({ width: initialWidth || 400, height: initialHeight || 300 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null); // Ref for resizing

  const handleMouseDown = (e) => {
    onFocus(id); // Bring to front on click
    setIsDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Resizing logic
  const handleResizeMouseDown = (e) => {
    e.stopPropagation(); // Prevent dragging when resizing
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const doResize = (moveEvent) => {
      const newWidth = Math.max(200, startWidth + (moveEvent.clientX - startX));
      const newHeight = Math.max(150, startHeight + (moveEvent.clientY - startY));
      setSize({ width: newWidth, height: newHeight });
    };

    const stopResize = () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    } else {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, offset]);

  return (
    <div
      ref={windowRef}
      className={`absolute bg-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col border ${focused ? 'border-blue-500' : 'border-gray-600'}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        minWidth: '587px',
        minHeight: '372px',
        zIndex: focused ? 200 : 100, // Focused window is on top
      }}
      onMouseDown={() => onFocus(id)} // Focus on any click within the window
    >
      {/* Window Header */}
      <div
        className="flex items-center justify-between p-2 bg-gray-800 text-white cursor-grab rounded-t-lg"
        onMouseDown={handleMouseDown}
      >
        <span className="font-semibold text-sm">{title}</span>
        <div className="flex space-x-2">
          {/* Minimize Button */}
          <button
            className="w-4 h-4 bg-yellow-500 rounded-full hover:bg-yellow-600 transition-colors"
            onClick={(e) => { e.stopPropagation(); onMinimize && onMinimize(id); }}
            title="Minimize"
          ></button>
          {/* Maximize Button */}
          <button
            className="w-4 h-4 bg-green-500 rounded-full hover:bg-green-600 transition-colors"
            onClick={(e) => { e.stopPropagation(); onMaximize && onMaximize(id); }}
            title="Maximize"
          ></button>
          {/* Close Button */}
          <button
            className="w-4 h-4 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
            onClick={(e) => { e.stopPropagation(); onClose(id); }}
            title="Close"
          ></button>
        </div>
      </div>
      {/* Window Content */}
      <div className="flex-grow p-4 overflow-auto text-gray-200">
        {children}
      </div>
      {/* Resize Handle (bottom-right corner) */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 bg-gray-500 cursor-nwse-resize rounded-br-lg"
        onMouseDown={handleResizeMouseDown}
      ></div>
    </div>
  );
};

export default Window;