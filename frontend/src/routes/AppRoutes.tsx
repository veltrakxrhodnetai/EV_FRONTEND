import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import Login from '../pages/Login';
import OwnerDashboard from '../pages/OwnerDashboard';
import OwnerLogin from '../pages/OwnerLogin';
import StationDetail from '../pages/StationDetail';
import Stations from '../pages/Stations';

export default function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/stations" element={<Stations />} />
      <Route path="/stations/:id" element={<StationDetail />} />

      <Route path="/owner/login" element={<OwnerLogin />} />
      <Route
        path="/owner/dashboard"
        element={
          <ProtectedRoute tokenKey="ownerAuthToken">
            <OwnerDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/stations" replace />} />
      <Route path="*" element={<Navigate to="/stations" replace />} />
    </Routes>
  );
}
