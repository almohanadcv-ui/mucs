import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const interceptorIdRef = useRef(null);

  useEffect(() => {
    const userInfo = localStorage.getItem('mab_userInfo');
    if (userInfo) {
      try {
        const parsed = JSON.parse(userInfo);
        setUser(parsed);
        axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.token}`;
        // Refresh user data from server (fetches latest role + permissions).
        // Critical when admin grants permissions while user is logged in —
        // the cached localStorage data is stale and would hide UI sections.
        axios.get('/api/auth/profile')
          .then((res) => {
            if (res.data && res.data.id) {
              const merged = { ...parsed, ...res.data, token: parsed.token };
              setUser(merged);
              localStorage.setItem('mab_userInfo', JSON.stringify(merged));
            }
          })
          .catch(() => { /* 401 is handled by interceptor */ });
      } catch {
        localStorage.removeItem('mab_userInfo');
      }
    }
    setLoading(false);
  }, []);

  // Manual refresh helper (used after admin grants new permissions, etc.)
  const refreshProfile = async () => {
    try {
      const res = await axios.get('/api/auth/profile');
      if (res.data && res.data.id) {
        setUser((prev) => {
          const merged = { ...(prev || {}), ...res.data, token: prev?.token };
          localStorage.setItem('mab_userInfo', JSON.stringify(merged));
          return merged;
        });
      }
    } catch { /* ignored */ }
  };

  // Auto-logout on 401 responses
  useEffect(() => {
    if (interceptorIdRef.current !== null) {
      axios.interceptors.response.eject(interceptorIdRef.current);
    }
    interceptorIdRef.current = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url || '';
        const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/change-password');
        if (status === 401 && user && !isAuthEndpoint) {
          localStorage.removeItem('mab_userInfo');
          setUser(null);
          delete axios.defaults.headers.common['Authorization'];
          const serverMsg = error?.response?.data?.message;
          const code = error?.response?.data?.code;
          if (code === 'SESSION_REPLACED') {
            toast.error(serverMsg || 'تم تسجيل الدخول من جهاز آخر.', { duration: 5000 });
          } else {
            toast.error(serverMsg || 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.');
          }
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      if (interceptorIdRef.current !== null) {
        axios.interceptors.response.eject(interceptorIdRef.current);
        interceptorIdRef.current = null;
      }
    };
  }, [user]);

  const login = async (email, password, subdomain) => {
    try {
      const res = await axios.post('/api/auth/login', { email, password, subdomain });
      setUser(res.data);
      localStorage.setItem('mab_userInfo', JSON.stringify(res.data));
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      toast.success('تم تسجيل الدخول بنجاح');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'خطأ في تسجيل الدخول');
      return false;
    }
  };

  const loginWithUserData = (userData) => {
    setUser(userData);
    localStorage.setItem('mab_userInfo', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    toast.success('تم تسجيل الدخول بنجاح');
  };

  const logout = async () => {
    // Tell the server to free this account's session slot.
    // Wait for completion so the next login on another device can proceed
    // immediately (no race).
    try {
      await axios.post('/api/auth/logout');
    } catch {
      // Ignore — we still log out locally
    }
    setUser(null);
    localStorage.removeItem('mab_userInfo');
    delete axios.defaults.headers.common['Authorization'];
    toast.success('تم تسجيل الخروج');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, loginWithUserData, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
