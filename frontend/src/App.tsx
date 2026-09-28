import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage from './pages/auth/AuthPage';
import BillingSummaryPage from './pages/customer/BillingSummaryPage';
import ChargingOptionsPage from './pages/customer/ChargingOptionsPage';
import LiveSessionPage from './pages/customer/LiveSessionPage';
import StationDetailPage from './pages/customer/StationDetailPage';
import StationListPage from './pages/customer/StationListPage';
import OwnerBillingPage from './pages/owner/OwnerBillingPage';
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';
import OwnerLiveSessionPage from './pages/owner/OwnerLiveSessionPage';
import OwnerLoginPage from './pages/owner/OwnerLoginPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminRoleRoute from './components/AdminRoleRoute';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminStationsPage from './pages/admin/AdminStationsPage';
import AdminChargersPage from './pages/admin/AdminChargersPage';
import AdminConnectorsPage from './pages/admin/AdminConnectorsPage';
import AdminPricingPage from './pages/admin/AdminPricingPage';
import AdminOwnersPage from './pages/admin/AdminOwnersPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminRfidPage from './pages/admin/AdminRfidPage';
import AdminOcppConfigPage from './pages/admin/AdminOcppConfigPage';
import ConnectorVerificationPage from './pages/customer/ConnectorVerificationPage';
import InvoicePage from './pages/customer/InvoicePage';

import AdminLogsPage from './pages/admin/AdminLogsPage';
import AdminUptimePage from './pages/admin/AdminUptimePage';
import AdminSettlementPage from './pages/admin/AdminSettlementPage';
import AdminLiteLayout from './pages/admin-lite/AdminLiteLayout';
import AdminLiteDashboardPage from './pages/admin-lite/AdminLiteDashboardPage';
import AdminLiteStationsPage from './pages/admin-lite/AdminLiteStationsPage';
import AdminLiteChargersPage from './pages/admin-lite/AdminLiteChargersPage';
import AdminLiteTariffsPage from './pages/admin-lite/AdminLiteTariffsPage';
import AdminLiteOwnersPage from './pages/admin-lite/AdminLiteOwnersPage';
import AdminLiteUsersPage from './pages/admin-lite/AdminLiteUsersPage';
import AdminLiteOcppPage from './pages/admin-lite/AdminLiteOcppPage';
import AdminLiteUptimePage from './pages/admin-lite/AdminLiteUptimePage';
import { getCustomerActiveSessionId } from './utils/authSession';
import UserHomePage from './pages/customer/UserHomePage';
import './index.css';

function LoginRoute(): JSX.Element {
  const token = localStorage.getItem('authToken');
  if (!token) {
    return <AuthPage />;
  }

  const activeSessionId = getCustomerActiveSessionId();
  if (activeSessionId) {
    return <Navigate to={`/customer/session/${activeSessionId}/live`} replace />;
  }

  return <Navigate to="/" replace />;
}

function HomeRoute(): JSX.Element {
  return <UserHomePage />;
}

export default function App(): JSX.Element {
  return (
    <Routes>
      {/* Home: UserHomePage if logged in, else public discovery */}
      <Route path="/" element={<HomeRoute />} />

      {/* Customer Auth Route */}
      <Route path="/login" element={<LoginRoute />} />

      {/* Protected Customer Routes */}
      <Route
        path="/stations"
        element={
          <ProtectedRoute>
            <StationListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/station/:id"
        element={
          <ProtectedRoute>
            <StationDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/station/:id/charger/:cid/connector/:connid"
        element={
          <ProtectedRoute>
            <ChargingOptionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/session/:id/live"
        element={
          <ProtectedRoute>
            <LiveSessionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/session/:id/bill"
        element={
          <ProtectedRoute>
            <BillingSummaryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/session/verify"
        element={
          <ProtectedRoute>
            <ConnectorVerificationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/session/:sessionId/invoice"
        element={
          <ProtectedRoute>
            <InvoicePage />
          </ProtectedRoute>
        }
      />

      {/* Owner Routes */}
      <Route path="/owner/login" element={<OwnerLoginPage />} />
      <Route
        path="/owner/dashboard"
        element={
          <ProtectedRoute tokenKey="ownerAuthToken">
            <OwnerDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/session/:id/live"
        element={
          <ProtectedRoute tokenKey="ownerAuthToken">
            <OwnerLiveSessionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/session/:id/bill"
        element={
          <ProtectedRoute tokenKey="ownerAuthToken">
            <OwnerBillingPage />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute tokenKey="adminAuthToken">
            <AdminRoleRoute allowedRoles={['SUPER_ADMIN']}>
              <AdminLayout />
            </AdminRoleRoute>
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="stations" element={<AdminStationsPage />} />
        <Route path="chargers" element={<AdminChargersPage />} />
        <Route path="connectors" element={<AdminConnectorsPage />} />
        <Route path="pricing" element={<AdminPricingPage />} />
        <Route path="owners" element={<AdminOwnersPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="rfid" element={<AdminRfidPage />} />
        <Route path="ocpp" element={<AdminOcppConfigPage />} />
        <Route path="logs" element={<AdminLogsPage />} />
        <Route path="uptime" element={<AdminUptimePage />} />
        <Route path="settlement" element={<AdminSettlementPage />} />
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      <Route
        path="/admin-lite"
        element={
          <ProtectedRoute tokenKey="adminAuthToken">
            <AdminRoleRoute allowedRoles={['ADMIN']}>
              <AdminLiteLayout />
            </AdminRoleRoute>
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminLiteDashboardPage />} />
        <Route path="stations" element={<AdminLiteStationsPage />} />
        <Route path="chargers" element={<AdminLiteChargersPage />} />
        <Route path="tariffs" element={<AdminLiteTariffsPage />} />
        <Route path="owners" element={<AdminLiteOwnersPage />} />
        <Route path="users" element={<AdminLiteUsersPage />} />
        <Route path="ocpp" element={<AdminLiteOcppPage />} />
        <Route path="uptime" element={<AdminLiteUptimePage />} />
        <Route path="settlement" element={<AdminSettlementPage />} />
        <Route index element={<Navigate to="/admin-lite/dashboard" replace />} />
      </Route>

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
