import api from './axios';
import axios from 'axios';
import type { BillSummary, LiveSession, StartSessionRequest } from '../types';

export interface StartSessionResponse {
  sessionId: number;
  preauthAmount?: number;
  preauthId?: string;
  message: string;
  status: string;
}

export interface CustomerActiveSessionResponse {
  active: boolean;
  sessionId?: number;
  status?: string;
}

export interface PaymentConfigResponse {
  provider: string;
  enabled: boolean;
  keyId: string;
}

export async function startSession(data: StartSessionRequest): Promise<StartSessionResponse> {
  const response = await api.post<StartSessionResponse>('/api/sessions/start', data);
  return response.data;
}

export async function verifyConnector(sessionId: number): Promise<{ sessionId: number; message: string; status: string }> {
  const response = await api.post<{ sessionId: number; message: string; status: string }>(`/api/sessions/${sessionId}/verify-connector`);
  return response.data;
}

export async function payAndStart(sessionId: number, razorpayPaymentId?: string): Promise<{ sessionId: number; message: string; status: string; paymentStatus: string; preauthId?: string }> {
  const response = await api.post<{ sessionId: number; message: string; status: string; paymentStatus: string; preauthId?: string }>(`/api/sessions/${sessionId}/pay-and-start`, { razorpayPaymentId });
  return response.data;
}

export async function cancelSession(sessionId: number): Promise<{ message: string; sessionId: number }> {
  const response = await api.post<{ message: string; sessionId: number }>(`/api/sessions/${sessionId}/cancel`);
  return response.data;
}

export async function getInvoice(sessionId: number): Promise<any> {
  const response = await api.get(`/api/sessions/${sessionId}/invoice`);
  return response.data;
}

export async function getLiveSession(sessionId: string | number): Promise<LiveSession> {
  const response = await api.get<LiveSession>(`/api/sessions/${sessionId}/live`, {
    params: { t: Date.now() },
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
  return response.data;
}

export async function stopSession(sessionId: string | number): Promise<{ message: string; mode?: string; sessionId?: number }> {
  const response = await api.post<{ message: string; mode?: string; sessionId?: number }>(`/api/sessions/${sessionId}/stop`);
  return response.data;
}

export async function getBill(sessionId: string | number): Promise<BillSummary> {
  const response = await api.get<BillSummary>(`/api/sessions/${sessionId}/bill`);
  return response.data;
}

export async function markPaid(sessionId: string | number): Promise<{ sessionId: number; paymentStatus: string }> {
  const response = await api.patch<{ sessionId: number; paymentStatus: string }>(`/api/sessions/${sessionId}/markpaid`);
  return response.data;
}

export async function getCustomerActiveSession(phoneNumber: string): Promise<CustomerActiveSessionResponse> {
  const response = await api.get<CustomerActiveSessionResponse>('/api/sessions/customer/active', {
    params: { phoneNumber },
  });
  return response.data;
}

export async function getPaymentConfig(): Promise<PaymentConfigResponse> {
  const response = await api.get<PaymentConfigResponse>('/api/payments/config');
  return response.data;
}

export interface OwnerActiveSession {
  sessionId: number;
  status: string;
  chargerId: number;
  chargerName: string;
  chargerOcppIdentity: string;
  connectorId: number;
  connectorNo: number;
  transactionId: number;
  vehicleNumber: string;
  phoneNumber: string;
  startedBy: string;
  paymentMode: string;
  paymentStatus: string;
  limitType: string;
  limitValue: number;
  startedAt: string;
  meterStart: number;
  latestMeterWh: number;
  energyConsumedKwh: number;
}

export async function getOwnerActiveSessions(): Promise<{ count: number; sessions: OwnerActiveSession[] }> {
  const response = await api.get<{ count: number; sessions: OwnerActiveSession[] }>('/api/sessions/owner/active-sessions');
  return response.data;
}

export interface OwnerCompletedLog {
  id: number;
  sessionId: number;
  stationId: number;
  stationName: string;
  chargerId: number;
  chargerName: string;
  chargerOcppIdentity: string;
  connectorNo: number;
  vehicleNumber: string;
  phoneNumber: string;
  startedBy: string;
  paymentMode: string;
  paymentStatus: string;
  energyConsumedKwh: number;
  amountPaid: number;
  startedAt: string;
  endedAt: string;
  paymentCompletedAt: string;
}

export async function getOwnerCompletedLogs(): Promise<{ count: number; logs: OwnerCompletedLog[] }> {
  const response = await api.get<{ count: number; logs: OwnerCompletedLog[] }>('/api/sessions/owner/completed-logs');
  return response.data;
}

export interface OwnerDashboardSession {
  sessionId: number;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  ownerId: number | null;
  stationId: number | null;
  chargerId: number | null;
  stationName: string | null;
  chargerName: string | null;
  chargerOcppIdentity: string | null;
  connectorNo: number | null;
  energyConsumedKwh: number | null;
  totalAmount: number | null;
  gstAmount: number | null;
  baseAmount: number | null;
  platformFee: number | null;
  ownerRevenue: number | null;
  paymentMode: string | null;
  paymentStatus: string | null;
  vehicleNumber: string | null;
  phoneNumber: string | null;
}

export interface OwnerDashboardResponse {
  ownerId: number;
  filters: {
    fromDate: string | null;
    toDate: string | null;
    stationId: number | null;
    chargerId: number | null;
  };
  aggregated: {
    totalRevenue: number;
    totalSessions: number;
    totalEnergyUsed: number;
  };
  sessions: OwnerDashboardSession[];
}

export interface OwnerDashboardFilters {
  fromDate?: string;
  toDate?: string;
  stationId?: number;
  chargerId?: number;
}

export async function getOwnerDashboardSessions(
  ownerId: number,
  filters: OwnerDashboardFilters = {}
): Promise<OwnerDashboardResponse> {
  const params = new URLSearchParams();

  if (filters.fromDate) {
    params.set('fromDate', filters.fromDate);
  }
  if (filters.toDate) {
    params.set('toDate', filters.toDate);
  }
  if (typeof filters.stationId === 'number') {
    params.set('stationId', String(filters.stationId));
  }
  if (typeof filters.chargerId === 'number') {
    params.set('chargerId', String(filters.chargerId));
  }

  const query = params.toString();
  const url = `/api/owner/dashboard/${ownerId}/sessions${query ? `?${query}` : ''}`;
  const response = await api.get<OwnerDashboardResponse>(url);
  return response.data;
}

export interface CustomerSessionHistory {
  sessionId: number;
  status: string;
  vehicleNumber?: string;
  energyConsumedKwh: number;
  totalAmount: number;
  paymentMode?: string;
  paymentStatus?: string;
  startedAt?: string;
  endedAt?: string;
  stationName: string;
}

export async function getCustomerSessionHistory(phoneNumber: string): Promise<CustomerSessionHistory[]> {
  try {
    const response = await api.get<CustomerSessionHistory[]>('/api/sessions/customer/history', {
      params: { phoneNumber },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return [];
    }
    throw error;
  }
}
