// frontend/src/apps/AboutApp.js
import React from 'react';

const AboutApp = () => {
  return (
    <div className="flex flex-col h-full p-6 text-gray-200 items-center justify-center text-center">
      <h2 className="text-3xl font-bold mb-4 text-blue-400">crusadeOS</h2>
      <p className="text-lg mb-2">Version: 3.0.0</p>
      <p className="mb-4">
        An open source, locally hosted, "web operating system" application built with React and Node js.
        Designed for personal use and as a demonstration of a browser-based desktop environment.
        This OS is still in beta.
      </p>
      <div className="mt-4 text-sm text-gray-400">
        <p>Developed by notpran</p>
        <p>Source Code: github.com/notpran/crusadeOS</p>
      </div>
      <div className="mt-6">
        <span role="img" aria-label="Crusade icon" className="text-6xl">🛡️</span>
      </div>
    </div>
  );
};

export default AboutApp;