const DEFAULT_API_BASE_URL = 'http://localhost:8080';
const DEFAULT_OCPP_WS_SCHEME = 'auto';

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
  .trim()
  .replace(/\/+$/, '');

export const API_BASE_URL = configuredApiBaseUrl;
const DEFAULT_OCPP_VERSION = '1.6';
const DEFAULT_STATION_SEGMENT = 'station';

const configuredOcppWsSchemeRaw = (import.meta.env.VITE_OCPP_WS_SCHEME || DEFAULT_OCPP_WS_SCHEME)
  .trim()
  .toLowerCase();

const configuredOcppWsScheme =
  configuredOcppWsSchemeRaw === 'ws' || configuredOcppWsSchemeRaw === 'wss'
    ? configuredOcppWsSchemeRaw
    : 'auto';

function resolveOcppWsProtocol(): 'ws' | 'wss' {
  if (configuredOcppWsScheme === 'ws' || configuredOcppWsScheme === 'wss') {
    return configuredOcppWsScheme;
  }
  return API_BASE_URL.toLowerCase().startsWith('https://') ? 'wss' : 'ws';
}

export function setWebSocketProtocol(url: string, protocol: 'ws' | 'wss'): string {
  const normalized = (url || '').trim();
  if (!normalized) {
    return normalized;
  }

  if (/^wss?:\/\//i.test(normalized)) {
    return normalized.replace(/^wss?:\/\//i, `${protocol}://`);
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/^https?:\/\//i, `${protocol}://`);
  }

  return normalized;
}

export const OCPP_WS_BASE_URL = `${API_BASE_URL.replace(/^https?:\/\//i, `${resolveOcppWsProtocol()}://`)}/ws/ocpp`;

export function buildOcppWsUrl(
  ocppIdentity?: string,
  stationId?: string | number,
  ocppVersion: string = DEFAULT_OCPP_VERSION
): string {
  if (!ocppIdentity) {
    return `${OCPP_WS_BASE_URL}/${encodeURIComponent(ocppVersion)}/${DEFAULT_STATION_SEGMENT}`;
  }

  const stationSegment =
    stationId === undefined || stationId === null || String(stationId).trim() === ''
      ? DEFAULT_STATION_SEGMENT
      : String(stationId).trim();

  return `${OCPP_WS_BASE_URL}/${encodeURIComponent(ocppVersion)}/${encodeURIComponent(stationSegment)}/${encodeURIComponent(ocppIdentity)}`;
}
