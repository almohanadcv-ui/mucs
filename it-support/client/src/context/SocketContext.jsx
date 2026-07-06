import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.token) {
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        auth: { token: user.token },
        transports: ['websocket', 'polling'],
      });
      setSocket(newSocket);

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });

      // Note: All notification toasts are owned by MainLayout (single source).
      // Do NOT add toast listeners here to avoid duplicates.

      return () => newSocket.close();
    } else {
      setSocket(null);
    }
  }, [user?.token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
