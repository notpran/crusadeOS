import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Make sure 'export' is here for AuthProvider
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(sessionStorage.getItem('authToken'));
  const [userId, setUserId] = useState(sessionStorage.getItem('userId'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('authToken'));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [installedApps, setInstalledApps] = useState([]);

  const fetchInstalledApps = useCallback(async (authToken) => {
    if (!authToken) return [];
    try {
      const response = await fetch('http://localhost:5000/api/apps/installed', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.error('Failed to fetch installed apps:', await response.json());
        return [];
      }
    } catch (error) {
      console.error('Error fetching installed apps:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('authToken');
    const storedUserId = sessionStorage.getItem('userId');
    if (storedToken && storedUserId) {
      setToken(storedToken);
      setUserId(storedUserId);
      setIsAuthenticated(true);
      fetchInstalledApps(storedToken).then(apps => setInstalledApps(apps));
    }
    setIsAuthReady(true);
  }, [fetchInstalledApps]);

  const login = async (newToken, newUserId) => {
    sessionStorage.setItem('authToken', newToken);
    sessionStorage.setItem('userId', newUserId);
    setToken(newToken);
    setUserId(newUserId);
    setIsAuthenticated(true);
    const apps = await fetchInstalledApps(newToken);
    setInstalledApps(apps);
  };

  const logout = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        console.error('Logout failed on server:', await response.json());
      }
    } catch (error) {
      console.error('Error during logout request:', error);
    } finally {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userId');
        setToken(null);
        setUserId(null);
        setIsAuthenticated(false);
        setInstalledApps([]);
    }
  };

  const updateInstalledApps = useCallback(async () => {
    const apps = await fetchInstalledApps(token);
    setInstalledApps(apps);
  }, [fetchInstalledApps, token]);


  return (
    <AuthContext.Provider value={{ token, userId, isAuthenticated, isAuthReady, login, logout, installedApps, updateInstalledApps }}>
      {children}
    </AuthContext.Provider>
  );
};

// Make sure 'export' is here for useAuth
export const useAuth = () => useContext(AuthContext);