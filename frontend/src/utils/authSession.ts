type JwtPayload = {
  sub?: string;
  name?: string;
  username?: string;
  phoneNumber?: string;
  mobile?: string;
  stations?: Array<number | string>;
  roles?: Record<string, string>;
};

type StationInfo = {
  stationId: number;
  role: string;
};

const CUSTOMER_PHONE_KEY = 'customerPhoneNumber';
const CUSTOMER_NAME_KEY = 'customerName';
const CUSTOMER_ACTIVE_SESSION_ID_KEY = 'customerActiveSessionId';
const OWNER_USERNAME_KEY = 'ownerUsername';
const OWNER_ID_KEY = 'ownerId';
const OWNER_STATIONS_KEY = 'ownerAssignedStations';

function decodeJwtPayload(tokenWithType: string): JwtPayload | null {
  const token = tokenWithType.startsWith('Bearer ') ? tokenWithType.slice(7) : tokenWithType;
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payloadText = atob(padded);
    return JSON.parse(payloadText) as JwtPayload;
  } catch {
    return null;
  }
}

export function setCustomerSessionInfo(phoneNumber: string, name?: string): void {
  if (phoneNumber?.trim()) {
    localStorage.setItem(CUSTOMER_PHONE_KEY, phoneNumber.trim());
  }
  if (name?.trim()) {
    localStorage.setItem(CUSTOMER_NAME_KEY, name.trim());
  }
}

export function setCustomerSessionFromToken(tokenWithType: string): void {
  const payload = decodeJwtPayload(tokenWithType);
  if (!payload) {
    return;
  }

  if (payload.name?.trim()) {
    localStorage.setItem(CUSTOMER_NAME_KEY, payload.name.trim());
  }

  const possiblePhone = payload.phoneNumber ?? payload.sub;
  if (possiblePhone?.trim()) {
    localStorage.setItem(CUSTOMER_PHONE_KEY, possiblePhone.trim());
  }
}

export function getCustomerPhone(): string | null {
  return localStorage.getItem(CUSTOMER_PHONE_KEY)?.trim() ?? null;
}

export function getCustomerDisplayText(): string {
  const name = localStorage.getItem(CUSTOMER_NAME_KEY)?.trim();
  const phone = localStorage.getItem(CUSTOMER_PHONE_KEY)?.trim();

  if (name && phone) {
    return `${name} (${phone})`;
  }
  if (name) {
    return name;
  }
  if (phone) {
    return phone;
  }
  return 'Customer';
}

export function logoutCustomer(): void {
  localStorage.removeItem('authToken');
  localStorage.removeItem('hasPasscode');
  localStorage.removeItem(CUSTOMER_PHONE_KEY);
  localStorage.removeItem(CUSTOMER_NAME_KEY);
}

export function setCustomerActiveSessionId(sessionId: number | string): void {
  const parsed = Number(sessionId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return;
  }
  localStorage.setItem(CUSTOMER_ACTIVE_SESSION_ID_KEY, String(Math.trunc(parsed)));
}

export function getCustomerActiveSessionId(): number | null {
  const raw = localStorage.getItem(CUSTOMER_ACTIVE_SESSION_ID_KEY);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.trunc(parsed);
}

export function clearCustomerActiveSessionId(): void {
  localStorage.removeItem(CUSTOMER_ACTIVE_SESSION_ID_KEY);
}

export function setOwnerSessionInfo(name: string, ownerId?: number, assignedStations?: StationInfo[]): void {
  if (name?.trim()) {
    localStorage.setItem(OWNER_USERNAME_KEY, name.trim());
  }
  if (ownerId) {
    localStorage.setItem(OWNER_ID_KEY, ownerId.toString());
  }
  if (assignedStations && assignedStations.length > 0) {
    localStorage.setItem(OWNER_STATIONS_KEY, JSON.stringify(assignedStations));
  }
}

export function getOwnerDisplayText(): string {
  const stored = localStorage.getItem(OWNER_USERNAME_KEY)?.trim();
  if (stored) {
    return stored;
  }

  const token = localStorage.getItem('ownerAuthToken');
  const payload = token ? decodeJwtPayload(token) : null;
  return payload?.name?.trim() || payload?.username?.trim() || 'Owner';
}

export function getOwnerId(): number | null {
  const storedId = localStorage.getItem(OWNER_ID_KEY);
  if (storedId) {
    const parsedStoredId = parseInt(storedId, 10);
    if (Number.isFinite(parsedStoredId)) {
      return parsedStoredId;
    }
  }

  const token = localStorage.getItem('ownerAuthToken');
  const payload = token ? decodeJwtPayload(token) : null;
  if (!payload?.sub) {
    return null;
  }

  const parsedTokenId = parseInt(payload.sub, 10);
  return Number.isFinite(parsedTokenId) ? parsedTokenId : null;
}

export function getOwnerAssignedStations(): StationInfo[] {
  const stationsJson = localStorage.getItem(OWNER_STATIONS_KEY);
  if (stationsJson) {
    try {
      const parsed = JSON.parse(stationsJson) as StationInfo[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Fall back to token parsing below.
    }
  }

  const token = localStorage.getItem('ownerAuthToken');
  const payload = token ? decodeJwtPayload(token) : null;
  const stations = payload?.stations;
  const roles = payload?.roles ?? {};

  if (!Array.isArray(stations)) {
    return [];
  }

  return stations
    .map((stationId) => {
      const parsedStationId = typeof stationId === 'number' ? stationId : parseInt(stationId, 10);
      if (!Number.isFinite(parsedStationId)) {
        return null;
      }

      return {
        stationId: parsedStationId,
        role: roles[String(parsedStationId)] || '',
      };
    })
    .filter((station): station is StationInfo => station !== null);
}

export function canOwnerAccessStation(stationId: number): boolean {
  const stations = getOwnerAssignedStations();
  return stations.some((s) => s.stationId === stationId);
}

export function getOwnerRoleForStation(stationId: number): string {
  const stations = getOwnerAssignedStations();
  const station = stations.find((s) => s.stationId === stationId);
  return station?.role || '';
}

export function logoutOwner(): void {
  localStorage.removeItem('ownerAuthToken');
  localStorage.removeItem('ownerAuth');
  localStorage.removeItem(OWNER_USERNAME_KEY);
  localStorage.removeItem(OWNER_ID_KEY);
  localStorage.removeItem(OWNER_STATIONS_KEY);
}
