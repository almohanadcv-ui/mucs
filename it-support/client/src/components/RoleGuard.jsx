/**
 * RoleGuard — UX layer that blocks unauthorized users from admin URLs.
 *
 * Accepts EITHER:
 *   - roles=[...]       — user passes if their role is in the list
 *   - permissions=[...] — user passes if they hold any of these permissions
 *
 * Real authorization lives server-side; this is just for navigation hygiene.
 *
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleGuard = ({ roles, permissions, children, redirectTo = '/dashboard' }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;

  const hasRole = roles ? roles.includes(user.role) : false;
  const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
  const hasPermission = permissions
    ? permissions.some(p => userPerms.includes(p))
    : false;

  // Allow if either role OR permission grants access
  if (!hasRole && !hasPermission) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
};

export default RoleGuard;
