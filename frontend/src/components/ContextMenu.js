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
      {items.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={index} className="my-1 border-t border-gray-700" />;
        }
        if (item.submenu) {
          return (
            <div key={index} className="relative group">
              <button
                className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors flex justify-between items-center"
                disabled={item.disabled}
              >
                {item.label}
                <span className="ml-2">▶</span>
              </button>
              <div className="absolute left-full top-0 bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-700 hidden group-hover:block min-w-[120px]">
                {item.submenu.map((subItem, subIdx) => (
                  <button
                    key={subIdx}
                    onClick={() => {
                      subItem.onClick();
                      onClose();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors"
                    disabled={subItem.disabled}
                  >
                    {subItem.label}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return (
          <button
            key={index}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors"
            disabled={item.disabled}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;