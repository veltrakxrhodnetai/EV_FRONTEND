import axios from 'axios';

export interface StationInfo {
  id: number;
  name: string;
  location: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  totalChargers?: number;
}

export interface ChargerInfo {
  id: number;
  ocppIdentity: string;
  name: string;
  vendorName: string;
  model: string;
  serialNumber: string;
  chargerType: string;
  maxPowerKw: number;
  status: string;
  communicationStatus: string;
  lastHeartbeat: string | null;
  stationId: number;
  ocppVersion: string;
  enabled: boolean;
}

export interface ConnectorInfo {
  id: number;
  connectorNo: number;
  type: string;
  maxPowerKw: number;
  status: string;
  chargerId?: number;
}

export interface ChargingSessionInfo {
  id: number;
  vehicleNumber: string;
  status: string;
  meterStart: number;
  meterValue: number;
  startTime: string;
  endTime: string | null;
  energyDelivered: number;
  totalAmount: number;
}

export interface ChargerActiveSessionInfo {
  active: boolean;
  sessionId?: number;
  status?: string;
  connectorNo?: number;
  transactionId?: number | null;
  meterStart?: number;
  latestMeterWh?: number;
  vehicleNumber?: string;
  phoneNumber?: string;
  startedBy?: string;
  paymentMode?: string;
  paymentStatus?: string;
  limitType?: string;
  limitValue?: number;
  startedAt?: string;
}

export interface ConnectorEventLog {
  timestamp: string;
  eventType: string;
  chargerId: string;
  connectorId: number | null;
  status: string;
  sessionId: number | null;
  transactionId: number | null;
  message: string;
}

export interface LiveMonitorStats {
  activeChargingSessions: number;
  pendingStartSessions: number;
  pendingVerificationSessions: number;
  pendingPaymentSessions?: number;
  connectedChargers: number;
  recentConnectorEvents: ConnectorEventLog[];
}

export interface ActiveSessionMonitorItem {
  sessionId: number;
  status: string;
  chargerOcppIdentity: string;
  connectorNo: number;
  transactionId: number | null;
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

export interface ActiveSessionsMonitorResponse {
  count: number;
  sessions: ActiveSessionMonitorItem[];
}

class BackendAPI {
  private baseUrl: string;

  private normalizeBaseUrl(url: string): string {
    let normalized = (url || '').trim();
    if (!normalized) {
      return 'http://localhost:8080';
    }

    // Users often paste OCPP WebSocket URLs here; convert them to REST base URL.
    normalized = normalized.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
    normalized = normalized.replace(/\/ws\/ocpp(?:\/.*)?$/i, '');
    normalized = normalized.replace(/\/ocpp(?:\/.*)?$/i, '');
    normalized = normalized.replace(/\/+$/, '');

    return normalized;
  }

  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = this.normalizeBaseUrl(baseUrl);
    axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
  }

  setBaseUrl(url: string) {
    this.baseUrl = this.normalizeBaseUrl(url);
  }

  // Get all stations from database
  async getAllStations(): Promise<StationInfo[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/stations`);
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (Array.isArray(data?.stations)) {
        return data.stations;
      }
      console.warn('Unexpected stations payload shape:', data);
      return [];
    } catch (error) {
      console.error('Failed to fetch stations:', error);
      return [];
    }
  }

  // Get chargers for a specific station
  async getChargersByStation(stationId: number): Promise<ChargerInfo[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/stations/${stationId}/chargers`);
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (Array.isArray(data?.chargers)) {
        return data.chargers;
      }
      console.warn(`Unexpected chargers payload for station ${stationId}:`, data);
      return [];
    } catch (error) {
      console.error(`Failed to fetch chargers for station ${stationId}:`, error);
      return [];
    }
  }

  // Get charger details by OCPP identity
  async getChargerByOcppIdentity(ocppIdentity: string): Promise<ChargerInfo | null> {
    try {
      const stations = await this.getAllStations();
      for (const station of stations) {
        const chargers = await this.getChargersByStation(station.id);
        const matched = chargers.find((charger) => charger.ocppIdentity === ocppIdentity);
        if (matched) {
          return {
            id: Number(matched.id),
            ocppIdentity: matched.ocppIdentity,
            name: matched.name || matched.ocppIdentity,
            vendorName: matched.vendorName || 'Unknown',
            model: matched.model || 'Unknown',
            serialNumber: matched.serialNumber || 'N/A',
            chargerType: matched.chargerType || 'DC',
            maxPowerKw: Number(matched.maxPowerKw || 0),
            status: matched.status || 'Unknown',
            communicationStatus: matched.communicationStatus || 'Unknown',
            lastHeartbeat: matched.lastHeartbeat || null,
            stationId: Number(matched.stationId || station.id),
            ocppVersion: matched.ocppVersion || '1.6',
            enabled: typeof matched.enabled === 'boolean' ? matched.enabled : true,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch charger info:', error);
      return null;
    }
  }

  // Get all chargers (for reference)
  async getAllChargers(): Promise<ChargerInfo[]> {
    try {
      const stations = await this.getAllStations();
      const allChargers: ChargerInfo[] = [];

      for (const station of stations) {
        const chargers = await this.getChargersByStation(station.id);
        chargers.forEach((charger) => {
          allChargers.push({
            id: Number(charger.id),
            ocppIdentity: charger.ocppIdentity,
            name: charger.name || charger.ocppIdentity,
            vendorName: charger.vendorName || 'Unknown',
            model: charger.model || 'Unknown',
            serialNumber: charger.serialNumber || 'N/A',
            chargerType: charger.chargerType || 'DC',
            maxPowerKw: Number(charger.maxPowerKw || 0),
            status: charger.status || 'Unknown',
            communicationStatus: charger.communicationStatus || 'Unknown',
            lastHeartbeat: charger.lastHeartbeat || null,
            stationId: Number(charger.stationId || station.id),
            ocppVersion: charger.ocppVersion || '1.6',
            enabled: typeof charger.enabled === 'boolean' ? charger.enabled : true,
          });
        });
      }

      return allChargers;
    } catch (error) {
      console.error('Failed to fetch chargers:', error);
      return [];
    }
  }

  // Get connectors for a charger
  async getConnectors(chargerId: number): Promise<ConnectorInfo[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/chargers/${chargerId}/connectors`);
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (Array.isArray(data?.connectors)) {
        return data.connectors;
      }
      console.warn(`Unexpected connectors payload for charger ${chargerId}:`, data);
      return [];
    } catch (error) {
      console.error('Failed to fetch connectors:', error);
      return [];
    }
  }

  // Get active charging session for charger identity
  async getActiveSessionByOcppIdentity(ocppIdentity: string): Promise<ChargerActiveSessionInfo | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/sessions/charger/${encodeURIComponent(ocppIdentity)}/active`);
      return response.data as ChargerActiveSessionInfo;
    } catch (error) {
      console.error('Failed to fetch active session:', error);
      return null;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/actuator/health`, { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      try {
        // Fallback: try the root endpoint
        const response = await axios.get(this.baseUrl, { timeout: 3000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  }

  // Get backend status with detailed info
  async getBackendStatus(): Promise<{
    connected: boolean;
    version?: string;
    uptime?: number;
  }> {
    try {
      const isHealthy = await this.healthCheck();
      return {
        connected: isHealthy,
        version: '1.0.0',
        uptime: isHealthy ? Date.now() : 0
      };
    } catch {
      return {
        connected: false
      };
    }
  }

  async getLiveMonitorStats(): Promise<LiveMonitorStats | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/sessions/monitor/live`);
      return response.data as LiveMonitorStats;
    } catch (error) {
      console.error('Failed to fetch live monitor stats:', error);
      return null;
    }
  }

  async getActiveSessionsMonitor(): Promise<ActiveSessionsMonitorResponse | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/sessions/monitor/active-sessions`);
      return response.data as ActiveSessionsMonitorResponse;
    } catch (error) {
      console.error('Failed to fetch active sessions monitor:', error);
      return null;
    }
  }

  async terminateSession(sessionId: number): Promise<{ message?: string; mode?: string } | null> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/sessions/${sessionId}/stop`);
      return response.data as { message?: string; mode?: string };
    } catch (error) {
      console.error(`Failed to terminate session ${sessionId}:`, error);
      return null;
    }
  }

  async resetSimulator(): Promise<{ message: string; chargersReset: number; connectorsReset: number; sessionsCompleted: number } | null> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/sessions/simulator/reset`);
      return response.data;
    } catch (error) {
      console.error('Failed to reset simulator:', error);
      return null;
    }
  }
}

export const backendAPI = new BackendAPI(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080');
