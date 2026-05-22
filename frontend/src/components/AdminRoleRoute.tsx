import React from 'react';
import { Navigate } from 'react-router-dom';
import { getAdminSession } from '../utils/adminAuth';

type AdminRoleRouteProps = {
  children: JSX.Element;
  allowedRoles: string[];
};

export default function AdminRoleRoute({ children, allowedRoles }: AdminRoleRouteProps): JSX.Element {
  const session = getAdminSession();

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  const currentRole = (session.role || '').toUpperCase();
  const normalizedAllowed = allowedRoles.map((role) => role.toUpperCase());
  if (!normalizedAllowed.includes(currentRole)) {
    if (currentRole === 'ADMIN') {
      return <Navigate to="/admin-lite/dashboard" replace />;
    }
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}
