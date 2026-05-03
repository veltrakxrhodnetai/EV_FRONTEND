import api from './axios';
import type { Charger, Station, Tariff } from '../types';

function toArrayResponse<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object') {
    const nested = (payload as Record<string, unknown>)[key];
    if (Array.isArray(nested)) {
      return nested as T[];
    }
  }

  return [];
}

export async function getStations(): Promise<Station[]> {
  const response = await api.get<Station[]>('/api/stations');
  return toArrayResponse<Station>(response.data, 'stations');
}

export async function getStationChargers(stationId: string | number): Promise<Charger[]> {
  const response = await api.get<Charger[]>(`/api/stations/${stationId}/chargers`);
  return toArrayResponse<Charger>(response.data, 'chargers');
}

export async function getStationTariff(stationId: string | number): Promise<Tariff> {
  const response = await api.get<Tariff>(`/api/stations/${stationId}/tariff`);
  if (response.data && typeof response.data === 'object') {
    return response.data;
  }

  return {
    pricePerKwh: 0,
    gstPercent: 0,
    platformFeePercent: 12,
    sessionFee: 0,
    currency: 'INR',
  };
}
