import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCustomerActiveSessionId } from '../utils/authSession';

type ProtectedRouteProps = {
  children: JSX.Element;
  tokenKey?: 'authToken' | 'ownerAuthToken' | 'adminAuthToken';
};

export default function ProtectedRoute({
  children,
  tokenKey = 'authToken',
}: ProtectedRouteProps): JSX.Element {
  const location = useLocation();
  const token = localStorage.getItem(tokenKey);
  if (!token) {
    if (tokenKey === 'ownerAuthToken') {
      return <Navigate to="/owner/login" replace />;
    }
    if (tokenKey === 'adminAuthToken') {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Customer lock: when a session is active, only Live Charging page is allowed.
  if (tokenKey === 'authToken') {
    const activeSessionId = getCustomerActiveSessionId();
    if (activeSessionId) {
      const livePath = `/customer/session/${activeSessionId}/live`;
      if (location.pathname !== livePath) {
        return <Navigate to={livePath} replace />;
      }
    }
  }

  return children;
}
