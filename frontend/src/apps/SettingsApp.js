// frontend/src/apps/SettingsApp.js
// This app is still in beta and is a work in progress!
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext'; // Assuming useAuth is available

const SettingsApp = () => {
  const { token } = useAuth();
  const [settings, setSettings] = useState({
    desktopBackgroundColor: '#1a202c', // Default dark gray
    desktopBackgroundImage: '',
    // Add more settings here
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchSettings = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/settings/load', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setSettings(prev => ({ ...prev, ...data })); // Merge fetched settings
      } else {
        setError(data.message || 'Failed to load settings.');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to connect to server or load settings.');
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const saveSettings = async () => {
    setMessage('');
    setError('');
    try {
      const response = await fetch('http://localhost:5000/api/settings/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Settings saved successfully!');
      } else {
        setError(data.message || 'Failed to save settings.');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to connect to server or save settings.');
    }
  };

  // This effect would apply the desktop background color to the main App component
  // You'll need to pass this setting up to App.js or use a global state management
  useEffect(() => {
    document.documentElement.style.setProperty('--desktop-bg-color', settings.desktopBackgroundColor);
    // For image, you'd set a background-image property on the desktop div
  }, [settings.desktopBackgroundColor]);

  return (
    <div className="flex flex-col h-full bg-gray-800 p-6 rounded-lg overflow-auto">
      <h2 className="text-2xl font-bold mb-6 text-blue-400">Settings</h2>

      {message && <p className="text-green-400 text-sm mb-4">{message}</p>}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="mb-6">
        <label htmlFor="desktopBackgroundColor" className="block text-gray-300 text-sm font-bold mb-2">
          Desktop Background Color:
        </label>
        <input
          type="color"
          id="desktopBackgroundColor"
          name="desktopBackgroundColor"
          value={settings.desktopBackgroundColor}
          onChange={handleSettingChange}
          className="w-24 h-10 p-1 rounded-md border border-gray-600 cursor-pointer"
        />
      </div>

      <button
        onClick={saveSettings}
        className="mt-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Save Settings
      </button>
    </div>
  );
};

export default SettingsApp;