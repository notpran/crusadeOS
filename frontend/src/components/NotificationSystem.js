// frontend/src/components/NotificationSystem.js
import React, { useState, createContext, useContext, useCallback } from 'react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const notificationIdRef = React.useRef(0);

  const addNotification = useCallback((message, type = 'info', duration = 3000) => {
    const id = notificationIdRef.current++;
    const newNotification = { id, message, type };
    setNotifications((prev) => [...prev, newNotification]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[1000] flex flex-col space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`relative p-4 rounded-lg shadow-xl text-white text-sm max-w-xs w-full transition-all duration-300 ease-out transform
              ${notification.type === 'info' ? 'bg-blue-600' : ''}
              ${notification.type === 'success' ? 'bg-green-600' : ''}
              ${notification.type === 'error' ? 'bg-red-600' : ''}
              ${notification.type === 'warning' ? 'bg-yellow-600' : ''}
            `}
            role="alert"
          >
            <p>{notification.message}</p>
            <button
              onClick={() => removeNotification(notification.id)}
              className="absolute top-1 right-2 text-white text-lg font-bold opacity-75 hover:opacity-100"
              aria-label="Close notification"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};