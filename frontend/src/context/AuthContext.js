import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // Refresh token every 4 minutes
const TOKEN_EXPIRY_TIME = 5 * 60 * 1000; // Token expires in 5 minutes

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(sessionStorage.getItem('authToken'));
  const [userId, setUserId] = useState(sessionStorage.getItem('userId'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('authToken'));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [installedApps, setInstalledApps] = useState([]);
  const [pinnedApps, setPinnedApps] = useState([]);
  const refreshTokenTimeoutRef = useRef();
  const lastActivityRef = useRef(Date.now());

  // Track user activity
  useEffect(() => {
    const updateLastActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', updateLastActivity);
    window.addEventListener('keypress', updateLastActivity);
    window.addEventListener('click', updateLastActivity);

    return () => {
      window.removeEventListener('mousemove', updateLastActivity);
      window.removeEventListener('keypress', updateLastActivity);
      window.removeEventListener('click', updateLastActivity);
    };
  }, []);

  const refreshToken = useCallback(async () => {
    if (!token) return;

    // Check if user has been inactive for more than TOKEN_EXPIRY_TIME
    const inactiveTime = Date.now() - lastActivityRef.current;
    if (inactiveTime > TOKEN_EXPIRY_TIME) {
      await logout();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { newToken } = await response.json();
        sessionStorage.setItem('authToken', newToken);
        setToken(newToken);
        scheduleTokenRefresh(); // Schedule next refresh
      } else {
        // If refresh fails, log out the user
        await logout();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      await logout();
    }
  }, [token]);

  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTokenTimeoutRef.current) {
      clearTimeout(refreshTokenTimeoutRef.current);
    }
    refreshTokenTimeoutRef.current = setTimeout(refreshToken, TOKEN_REFRESH_INTERVAL);
  }, [refreshToken]);

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

  // Add function to update pinned apps
  const updatePinnedApps = useCallback(async (newPinnedApps) => {
    setPinnedApps(newPinnedApps);
    // Here you would also persist the pinned apps to the server if needed
    if (token) {
      try {
        await fetch('http://localhost:5000/api/settings/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ pinnedApps: newPinnedApps })
        });
      } catch (error) {
        console.error('Error saving pinned apps:', error);
      }
    }
  }, [token]);

  // Add function to load pinned apps from settings
  const loadPinnedApps = useCallback(async (authToken) => {
    if (!authToken) return;
    try {
      const response = await fetch('http://localhost:5000/api/settings/load', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const settings = await response.json();
        if (settings.pinnedApps) {
          setPinnedApps(settings.pinnedApps);
        }
      }
    } catch (error) {
      console.error('Error loading pinned apps:', error);
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
      loadPinnedApps(storedToken);
      scheduleTokenRefresh(); // Start token refresh cycle
    }
    setIsAuthReady(true);

    return () => {
      if (refreshTokenTimeoutRef.current) {
        clearTimeout(refreshTokenTimeoutRef.current);
      }
    };
  }, [fetchInstalledApps, loadPinnedApps, scheduleTokenRefresh]);

  const login = async (newToken, newUserId) => {
    sessionStorage.setItem('authToken', newToken);
    sessionStorage.setItem('userId', newUserId);
    setToken(newToken);
    setUserId(newUserId);
    setIsAuthenticated(true);
    lastActivityRef.current = Date.now(); // Reset activity timer
    scheduleTokenRefresh(); // Start token refresh cycle
    const apps = await fetchInstalledApps(newToken);
    setInstalledApps(apps);
    await loadPinnedApps(newToken);
  };

  const logout = async () => {
    if (refreshTokenTimeoutRef.current) {
      clearTimeout(refreshTokenTimeoutRef.current);
    }

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userId');
      setToken(null);
      setUserId(null);
      setIsAuthenticated(false);
      setInstalledApps([]);
      setPinnedApps([]);
    }
  };

  const updateInstalledApps = useCallback(async () => {
    const apps = await fetchInstalledApps(token);
    setInstalledApps(apps);
  }, [fetchInstalledApps, token]);


  return (
    <AuthContext.Provider value={{
      token,
      userId,
      isAuthenticated,
      isAuthReady,
      login,
      logout,
      installedApps,
      updateInstalledApps,
      pinnedApps,
      updatePinnedApps
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Make sure 'export' is here for useAuth
export const useAuth = () => useContext(AuthContext);