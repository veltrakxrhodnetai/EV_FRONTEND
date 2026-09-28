import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/endpoints';

const ownerApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

ownerApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('ownerAuthToken');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return config;
});

export type OwnerConnector = {
  id: number;
  connectorNo: number;
  type: string;
  maxPowerKw: number;
  status: string;
};

export type OwnerChargerDetail = {
  id: number;
  stationId: number;
  name: string;
  ocppIdentity: string;
  status: string;
  enabled: boolean;
  communicationStatus: string;
  chargerType?: string;
  maxPowerKw?: number;
  vendorName?: string;
  model?: string;
  serialNumber?: string;
  lastHeartbeatAt?: string;
  connectors: OwnerConnector[];
};

export type OwnerCommandResponse = {
  action: string;
  status: string;
  payload: string;
};

export async function getOwnerChargersList(stationId?: number): Promise<OwnerChargerDetail[]> {
  const response = await ownerApi.get<OwnerChargerDetail[]>('/api/owner/chargers', {
    params: stationId ? { stationId } : {},
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function enableOwnerCharger(chargerId: number): Promise<OwnerChargerDetail> {
  const response = await ownerApi.patch<OwnerChargerDetail>(`/api/owner/chargers/${chargerId}/enable`);
  return response.data;
}

export async function disableOwnerCharger(chargerId: number): Promise<OwnerChargerDetail> {
  const response = await ownerApi.patch<OwnerChargerDetail>(`/api/owner/chargers/${chargerId}/disable`);
  return response.data;
}

export async function resetOwnerCharger(chargerId: number, type: 'Hard' | 'Soft'): Promise<OwnerCommandResponse> {
  const response = await ownerApi.post<OwnerCommandResponse>(`/api/owner/chargers/${chargerId}/reset`, { type });
  return response.data;
}

export async function setOwnerConnectorAvailability(
  connectorId: number,
  status: 'AVAILABLE' | 'UNAVAILABLE'
): Promise<OwnerConnector> {
  const response = await ownerApi.patch<OwnerConnector>(
    `/api/owner/connectors/${connectorId}/availability`,
    null,
    { params: { status } }
  );
  return response.data;
}

export async function updateOwnerCharger(
  chargerId: number,
  payload: {
    name?: string;
    vendorName?: string;
    model?: string;
    serialNumber?: string;
    chargerType?: string;
    maxPowerKw?: number;
  }
): Promise<OwnerChargerDetail> {
  const response = await ownerApi.put<OwnerChargerDetail>(`/api/owner/chargers/${chargerId}`, payload);
  return response.data;
}

export async function updateOwnerConnector(
  connectorId: number,
  payload: { connectorType?: string; maxPowerKw?: number }
): Promise<OwnerConnector> {
  const response = await ownerApi.put<OwnerConnector>(`/api/owner/connectors/${connectorId}`, payload);
  return response.data;
}

export type OwnerFinancialSummary = {
  totalOwnerRevenue: number;
  totalSettled: number;
  totalUnsettled: number;
};

export async function getOwnerFinancialSummary(): Promise<OwnerFinancialSummary> {
  const response = await ownerApi.get<OwnerFinancialSummary>('/api/owner/financial-summary');
  return response.data;
}

export async function addOwnerConnector(payload: {
  chargerId: number;
  connectorNo: number;
  connectorType: string;
  maxPowerKw: number;
}): Promise<OwnerConnector> {
  const response = await ownerApi.post<OwnerConnector>('/api/owner/connectors', payload);
  return response.data;
}
