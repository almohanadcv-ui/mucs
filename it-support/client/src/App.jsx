import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import Portal from './pages/Portal';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import CreateTicket from './pages/CreateTicket';
import Users from './pages/Users';
import Faq from './pages/Faq';
import Archive from './pages/Archive';
import Trash from './pages/Trash';
import Assets from './pages/Assets';
import MyAssets from './pages/MyAssets';
import SecurityLogs from './pages/SecurityLogs';
import RoleGuard from './components/RoleGuard';

const PRIVILEGED = ['IT_SUPPORT', 'ADMIN', 'SUPER_ADMIN'];
const ADMIN_ONLY = ['ADMIN', 'SUPER_ADMIN'];

function App() {
  const { user } = useAuth();

  // axios baseURL + Authorization header are set in main.jsx at module level.
  // Nothing more to do here for HTTP setup.

  useEffect(() => {
    const savedZoom = localStorage.getItem('zoomLevel');
    if (savedZoom) {
      document.documentElement.style.fontSize = `${savedZoom}%`;
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Routes>
        {/* Entry Portal */}
        <Route path="/" element={<Portal />} />
        
        {/* Dynamic Login Page based on Role */}
        <Route path="/login/:role" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={user ? <MainLayout /> : <Navigate to="/" />}>
          <Route index element={<Dashboard />} />
          {/* Open to everyone signed in */}
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/new" element={<CreateTicket />} />
          <Route path="faq" element={<Faq />} />
          <Route path="my-assets" element={<MyAssets />} />

          {/* Role-or-permission gated */}
          <Route path="users" element={
            <RoleGuard roles={PRIVILEGED} permissions={['USER_CREATE','USER_DELETE','USER_RESET_PW']}>
              <Users />
            </RoleGuard>
          } />
          <Route path="trash" element={
            <RoleGuard roles={PRIVILEGED} permissions={['VIEW_TRASH']}>
              <Trash />
            </RoleGuard>
          } />
          <Route path="assets" element={
            <RoleGuard roles={PRIVILEGED} permissions={['ASSET_CREATE','ASSET_EDIT','ASSET_DELETE','ASSET_ASSIGN']}>
              <Assets />
            </RoleGuard>
          } />

          {/* ADMIN + SUPER_ADMIN OR specific permission */}
          <Route path="archive" element={<RoleGuard roles={ADMIN_ONLY}><Archive /></RoleGuard>} />
          <Route path="security-logs" element={
            <RoleGuard roles={ADMIN_ONLY} permissions={['VIEW_LOGS']}>
              <SecurityLogs />
            </RoleGuard>
          } />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
