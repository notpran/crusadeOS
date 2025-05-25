import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// Make sure you import your AuthProvider component:
import { AuthProvider } from './context/AuthContext'; // <--- ADD THIS LINE

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Ensure App is wrapped by AuthProvider */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);