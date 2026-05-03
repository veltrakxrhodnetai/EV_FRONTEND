import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/endpoints';

const TOKEN_STORAGE_KEY = 'authToken';
const OWNER_TOKEN_STORAGE_KEY = 'ownerAuthToken';

export type StartSessionPayload = {
  chargerId: string;
  connectorNumber: number;
  limitType: 'Amount' | 'Energy' | 'Time' | string;
  limitValue: number;
};

export type OwnerStartSessionPayload = StartSessionPayload & {
  startedBy?: 'OWNER';
  vehicleNumber?: string;
  paymentMode?: 'Cash' | 'QR';
  skipPreAuth?: boolean;
  sessionStatus?: 'PENDING_PAYMENT' | 'ACTIVE';
};

export type OwnerAuthPayload =
  | {
      authMode: 'PASSWORD';
      username: string;
      password: string;
    }
  | {
      authMode: 'PIN';
      username: string;
      pin: string;
    };

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return config;
});

export async function requestOtp(mobile: string) {
  const response = await api.post('/api/auth/request-otp', { mobile });
  return response.data;
}

export async function verifyOtp(mobile: string, otp: string) {
  const response = await api.post('/api/auth/verify-otp', { mobile, otp });

  const token = response?.data?.token ? `${response.data.tokenType ?? 'Bearer'} ${response.data.token}` : null;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  return response.data;
}

export async function getStations() {
  const response = await api.get('/api/stations');
  return response.data;
}

export async function getStation(id: string) {
  const response = await api.get(`/api/stations/${id}`);
  return response.data;
}

export async function startSession(payload: StartSessionPayload) {
  const response = await api.post('/api/sessions/start', payload);
  return response.data;
}

export async function stopSession(sessionId: string) {
  const response = await api.post(`/api/sessions/${sessionId}/stop`);
  return response.data;
}

export async function getSession(sessionId: string) {
  const response = await api.get(`/api/sessions/${sessionId}`);
  return response.data;
}

export async function ownerAuth(payload: OwnerAuthPayload) {
  const response = await api.post('/api/owner/auth', payload);

  const token = response?.data?.token ? `${response.data.tokenType ?? 'Bearer'} ${response.data.token}` : null;
  if (token) {
    localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, token);
  }

  return response.data;
}

export async function getOwnerStations() {
  const response = await api.get('/api/owner/stations/me');
  return response.data;
}

export async function getOwnerActiveSessions() {
  const response = await api.get('/api/owner/sessions/active');
  return response.data;
}

export async function ownerStartSession(payload: OwnerStartSessionPayload) {
  const response = await api.post('/api/sessions/start', payload);
  return response.data;
}

export async function ownerStopSession(sessionId: string) {
  const response = await api.post(`/api/sessions/${sessionId}/stop`);
  return response.data;
}

export async function generatePaymentQr(sessionId: string) {
  const response = await api.post('/api/payments/qr', { sessionId });
  return response.data;
}

export async function markCashCollected(sessionId: string, ownerPin: string) {
  const response = await api.post('/api/owner/cash/collect', {
    sessionId,
    ownerPin,
  });
  return response.data;
}

export default api;
