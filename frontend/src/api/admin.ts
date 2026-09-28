import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/endpoints';

const adminApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

adminApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('adminAuthToken');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return config;
});

export async function adminLogin(username: string, password: string) {
  const response = await adminApi.post('/api/admin/auth/login', { username, password });
  return response.data;
}

export async function getAdminDashboardSummary() {
  const response = await adminApi.get('/api/admin/dashboard/summary');
  return response.data;
}

export type FinancialDistributionPoint = {
  label: string;
  value: number;
};

export type OwnerFinancialGroup = {
  ownerId: number | null;
  ownerName: string;
  totalCollected: number;
  totalGST: number;
  totalPlatformRevenue: number;
  totalOwnerPayable: number;
  totalSettled: number;
  totalPending: number;
  totalSessions: number;
};

export type StationFinancialGroup = {
  stationId: number | null;
  stationName: string;
  ownerId: number | null;
  ownerName: string;
  totalCollected: number;
  totalGST: number;
  totalPlatformRevenue: number;
  totalOwnerPayable: number;
  totalSettled: number;
  totalPending: number;
  settlementStatus: string;
  totalSessions: number;
};

export type StationSettlementResponse = {
  id: number | null;
  stationId: number;
  ownerId: number | null;
  totalRevenue: number;
  settledAmount: number;
  pendingAmount: number;
  status: string;
};

export type AdminFinancialDashboardResponse = {
  totalCollected: number;
  totalGST: number;
  totalPlatformRevenue: number;
  totalOwnerPayable: number;
  totalSettled: number;
  totalPending: number;
  byOwner: OwnerFinancialGroup[];
  byStation: StationFinancialGroup[];
  revenueDistribution: {
    byOwner: FinancialDistributionPoint[];
    byStation: FinancialDistributionPoint[];
  };
};

export async function getAdminFinancialDashboard() {
  const response = await adminApi.get<AdminFinancialDashboardResponse>('/api/admin/dashboard/financial');
  return response.data;
}

export async function markAdminStationSettlement(stationId: number, amount: number) {
  const response = await adminApi.post<StationSettlementResponse>(`/api/admin/stations/${stationId}/settlements`, { amount });
  return response.data;
}

export async function getAdminStations() {
  const response = await adminApi.get('/api/admin/stations');
  return response.data;
}

export async function createAdminStation(payload: Record<string, unknown>) {
  const response = await adminApi.post('/api/admin/stations', payload);
  return response.data;
}

export async function updateAdminStation(id: number, payload: Record<string, unknown>) {
  const response = await adminApi.put(`/api/admin/stations/${id}`, payload);
  return response.data;
}

export async function deactivateAdminStation(id: number) {
  const response = await adminApi.patch(`/api/admin/stations/${id}/deactivate`);
  return response.data;
}

export async function getAdminChargers(stationId?: number) {
  const response = await adminApi.get('/api/admin/chargers', {
    params: stationId ? { stationId } : {},
  });
  return response.data;
}

export async function createAdminCharger(payload: Record<string, unknown>) {
  const response = await adminApi.post('/api/admin/chargers', payload);
  return response.data;
}

export async function updateAdminCharger(id: number, payload: Record<string, unknown>) {
  const response = await adminApi.put(`/api/admin/chargers/${id}`, payload);
  return response.data;
}

export async function toggleAdminChargerEnable(id: number, enable: boolean) {
  const action = enable ? 'enable' : 'disable';
  const response = await adminApi.patch(`/api/admin/chargers/${id}/${action}`);
  return response.data;
}

export type AdminOcppCommandResponse = {
  action: string;
  status: string;
  payload: string;
};

export async function resetAdminCharger(id: number, type: 'Hard' | 'Soft') {
  const response = await adminApi.post<AdminOcppCommandResponse>(`/api/admin/chargers/${id}/reset`, { type });
  return response.data;
}

export type AdminActiveSession = {
  sessionId: number;
  status: string;
  chargerOcppIdentity: string | null;
  connectorNo: number | null;
  transactionId: number | null;
  vehicleNumber: string | null;
  phoneNumber: string | null;
  startedBy: string | null;
  paymentMode: string | null;
  paymentStatus: string | null;
  limitType: string | null;
  limitValue: number | null;
  startedAt: string | null;
  meterStart: number;
  latestMeterWh: number;
  energyConsumedKwh: number;
};

export type AdminActiveSessionsMonitorResponse = {
  count: number;
  sessions: AdminActiveSession[];
};

export async function getAdminActiveSessionsMonitor() {
  const response = await adminApi.get<AdminActiveSessionsMonitorResponse>('/api/sessions/monitor/active-sessions');
  return response.data;
}

export async function getAdminConnectors(chargerId: number) {
  const response = await adminApi.get('/api/admin/connectors', { params: { chargerId } });
  return response.data;
}

export async function createAdminConnector(payload: Record<string, unknown>) {
  const response = await adminApi.post('/api/admin/connectors', payload);
  return response.data;
}

export async function updateAdminConnector(connectorId: number, connectorType: string, maxPowerKw: number) {
  const response = await adminApi.put(`/api/admin/connectors/${connectorId}`, { connectorType, maxPowerKw });
  return response.data;
}

export async function deleteAdminConnector(connectorId: number) {
  await adminApi.delete(`/api/admin/connectors/${connectorId}`);
}

export async function deleteAdminCharger(chargerId: number) {
  await adminApi.delete(`/api/admin/chargers/${chargerId}`);
}

export async function setConnectorAvailability(
  connectorId: number,
  status: 'AVAILABLE' | 'UNAVAILABLE',
  options?: { forceLocal?: boolean }
) {
  const response = await adminApi.patch(`/api/admin/connectors/${connectorId}/availability`, null, {
    params: {
      status,
      ...(options?.forceLocal ? { forceLocal: true } : {}),
    },
  });
  return response.data;
}

export async function unlockAdminConnector(connectorId: number) {
  const response = await adminApi.post<AdminOcppCommandResponse>(`/api/admin/connectors/${connectorId}/unlock`);
  return response.data;
}

export async function getAdminTariffs() {
  const response = await adminApi.get('/api/admin/tariffs');
  return response.data;
}

export async function createAdminTariff(payload: Record<string, unknown>) {
  const response = await adminApi.post('/api/admin/tariffs', payload);
  return response.data;
}

export async function assignAdminStationTariff(stationId: number, payload: {
  pricePerKwh: number;
  gstPercent: number;
  idleFee: number;
  timeFee: number;
  platformFeePercent: number;
  currency: string;
}) {
  const response = await adminApi.put(`/api/admin/stations/${stationId}/tariff`, payload);
  return response.data;
}

export async function getAdminOcppConfigs() {
  const response = await adminApi.get('/api/admin/ocpp-configs');
  return response.data;
}

export async function getAdminChargerConfiguration(chargerId: number, keys?: string[]) {
  const response = await adminApi.get<AdminOcppCommandResponse>(`/api/admin/chargers/${chargerId}/ocpp/configuration`, {
    params: keys && keys.length > 0 ? { keys: keys.join(',') } : {},
  });
  return response.data;
}

export async function changeAdminChargerConfiguration(chargerId: number, key: string, value: string) {
  const response = await adminApi.post<AdminOcppCommandResponse>(`/api/admin/chargers/${chargerId}/ocpp/configuration/change`, {
    key,
    value,
  });
  return response.data;
}

export async function triggerAdminChargerMessage(chargerId: number, requestedMessage: string, connectorId?: number) {
  const response = await adminApi.post<AdminOcppCommandResponse>(`/api/admin/chargers/${chargerId}/ocpp/trigger-message`, {
    requestedMessage,
    connectorId,
  });
  return response.data;
}

export async function clearAdminChargerCache(chargerId: number) {
  const response = await adminApi.post<AdminOcppCommandResponse>(`/api/admin/chargers/${chargerId}/ocpp/clear-cache`);
  return response.data;
}

export type AdminConnectorDiscoveryResponse = {
  chargerId: number;
  chargePointIdentity: string;
  discovered: boolean;
  discoveredConnectorCount: number | null;
  createdConnectorNos: number[];
  message: string;
  payload: string;
};

export type AdminUnknownConnectorAlert = {
  timestamp: string;
  chargerId: string;
  connectorId: number;
  status: string;
  errorCode: string;
  message: string;
};

export type AdminUnknownConnectorAlertsResponse = {
  alerts: AdminUnknownConnectorAlert[];
  unknownConnectorIds: number[];
};

export async function discoverAdminChargerConnectors(chargerId: number) {
  const response = await adminApi.post<AdminConnectorDiscoveryResponse>(`/api/admin/chargers/${chargerId}/connectors/discover`);
  return response.data;
}

export async function getAdminUnknownConnectorAlerts(chargerId: number) {
  const response = await adminApi.get<AdminUnknownConnectorAlertsResponse>(`/api/admin/chargers/${chargerId}/connectors/unknown-alerts`);
  return response.data;
}

export async function clearAdminUnknownConnectorAlerts(chargerId: number) {
  await adminApi.delete(`/api/admin/chargers/${chargerId}/connectors/unknown-alerts`);
}

export async function createAdminOcppConfig(payload: Record<string, unknown>) {
  const response = await adminApi.post('/api/admin/ocpp-configs', payload);
  return response.data;
}

export async function updateAdminOcppConfig(id: number, payload: Record<string, unknown>) {
  const response = await adminApi.put(`/api/admin/ocpp-configs/${id}`, payload);
  return response.data;
}

export async function deleteAdminOcppConfig(id: number) {
  const response = await adminApi.delete(`/api/admin/ocpp-configs/${id}`);
  return response.data;
}

export async function deleteAdminStation(stationId: number) {
  await adminApi.delete(`/api/admin/stations/${stationId}`);
}

export async function getAdminOwners() {
  const response = await adminApi.get('/api/admin/owners');
  return response.data;
}

export async function getAdminOwnersByStation(stationId: number) {
  const response = await adminApi.get('/api/admin/owners', { params: { stationId } });
  return response.data;
}

export async function createAdminOwner(payload: Record<string, unknown>) {
  const response = await adminApi.post('/api/admin/owners', payload);
  return response.data;
}

export async function deleteAdminOwner(ownerId: number) {
  const response = await adminApi.delete(`/api/admin/owners/${ownerId}`);
  return response.data;
}

export async function getAdminOwnerAssignments(ownerId: number) {
  const response = await adminApi.get(`/api/admin/owners/${ownerId}/assignments`);
  return response.data;
}

export async function updateAdminOwnerAssignments(
  ownerId: number,
  payload: { stationIds: number[]; role: string }
) {
  const response = await adminApi.put(`/api/admin/owners/${ownerId}/assignments`, payload);
  return response.data;
}

export async function resetAdminOwnerPassword(ownerId: number, newPassword: string) {
  const response = await adminApi.put<{ message: string }>(`/api/admin/owners/${ownerId}/reset-password`, { newPassword });
  return response.data;
}

export async function loginAsOwner(ownerId: number): Promise<{ token: string }> {
  const response = await adminApi.post<{ token: string }>(`/api/admin/owners/${ownerId}/login-as`);
  return response.data;
}

export async function getAdminUsers() {
  const response = await adminApi.get('/api/admin/users');
  return response.data;
}

export async function blockAdminUser(userId: number) {
  const response = await adminApi.patch(`/api/admin/users/${userId}/block`);
  return response.data;
}

export async function unblockAdminUser(userId: number) {
  const response = await adminApi.patch(`/api/admin/users/${userId}/unblock`);
  return response.data;
}

export async function getAdminRfidTags() {
  const response = await adminApi.get('/api/admin/rfid-tags');
  return response.data;
}

export async function createAdminRfidTag(payload: Record<string, unknown>) {
  const response = await adminApi.post('/api/admin/rfid-tags', payload);
  return response.data;
}

export async function blockRfidTag(id: number) {
  const response = await adminApi.patch(`/api/admin/rfid-tags/${id}/block`);
  return response.data;
}

export async function unblockRfidTag(id: number) {
  const response = await adminApi.patch(`/api/admin/rfid-tags/${id}/unblock`);
  return response.data;
}

export async function getAdminSystemLogs() {
  const response = await adminApi.get('/api/admin/logs/system');
  return response.data;
}

export async function getAdminOcppLogs() {
  const response = await adminApi.get('/api/admin/logs/ocpp');
  return response.data;
}

export async function getAdminCompletedSessionLogs() {
  const response = await adminApi.get('/api/admin/logs/completed-sessions');
  return response.data;
}

export type AdminLiveMonitorEvent = {
  timestamp?: string;
  eventType?: string;
  chargerId?: string;
  connectorId?: number | null;
  status?: string;
  sessionId?: number | null;
  transactionId?: number | null;
  message?: string;
};

export type AdminLiveMonitorResponse = {
  activeChargingSessions: number;
  pendingStartSessions: number;
  pendingVerificationSessions: number;
  connectedChargers: number;
  recentConnectorEvents: AdminLiveMonitorEvent[];
};

export async function getAdminLiveMonitor() {
  const response = await adminApi.get<AdminLiveMonitorResponse>('/api/sessions/monitor/live');
  return response.data;
}

// ── Uptime ────────────────────────────────────────────────────────────────────

export type UptimeStatusLogEntry = {
  id: number;
  status: 'ONLINE' | 'OFFLINE' | 'FAULTED';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
};

export type ChargerUptimeSummary = {
  chargerId: number;
  chargerName: string;
  ocppIdentity: string;
  stationId: number | null;
  totalOnlineSeconds: number;
  totalOfflineSeconds: number;
  totalFaultedSeconds: number;
  statusLogs: UptimeStatusLogEntry[];
};

export async function getAdminUptimeSummary(from: string, to: string) {
  const response = await adminApi.get<ChargerUptimeSummary[]>('/api/admin/uptime/summary', {
    params: { from, to },
  });
  return response.data;
}

export async function getAdminChargerUptimeTimeline(chargerId: number, from: string, to: string) {
  const response = await adminApi.get<ChargerUptimeSummary>(`/api/admin/uptime/${chargerId}/timeline`, {
    params: { from, to },
  });
  return response.data;
}

export function getAdminUptimeExportUrl(from: string, to: string): string {
  return `/api/admin/uptime/export?from=${from}&to=${to}`;
}

export function getAdminChargerUptimeExportUrl(chargerId: number, from: string, to: string): string {
  return `/api/admin/uptime/${chargerId}/export?from=${from}&to=${to}`;
}
