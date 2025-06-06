import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Corrected path relative to LoginScreen.js

const LoginScreen = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    setError('');
    setMessage('');
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok) {
        login(data.token, data.userId); // Use login from context
        setMessage('Logged in successfully!');
      } else {
        setError(data.message || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      console.error("Login request error:", err);
      setError('Failed to connect to the local server. Ensure it is running.');
    }
  };

  const handleSignUp = async () => {
    setError('');
    setMessage('');
    try {
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'User registered successfully! You can now log in.');
      } else {
        setError(data.message || 'Signup failed.');
      }
    } catch (err) {
      console.error("Signup request error:", err);
      setError('Failed to connect to the local server. Ensure it is running.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-inter">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-96">
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">Web OS Login</h2>
        <div className="mb-4">
          <input
            type="text"
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleLogin();
            }}
          />
        </div>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        {message && <p className="text-green-400 text-sm mb-4 text-center">{message}</p>}
        <div className="flex space-x-4">
          <button
            onClick={handleLogin}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Login
          </button>
          <button
            onClick={handleSignUp}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Sign Up
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-4 text-center">
          Note: This is a local prototype. Passwords are hashed, but for real security, use HTTPS and stronger auth.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;