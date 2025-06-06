// frontend/src/components/ContextMenu.js
import React, { useEffect, useRef } from 'react';

const ContextMenu = ({ x, y, items, onClose }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-700"
      style={{ top: y, left: x }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.onClick();
            onClose(); // Close menu after click
          }}
          className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors"
          disabled={item.disabled}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;