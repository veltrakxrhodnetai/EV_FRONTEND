export interface Station {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  mapEmbedHtml?: string;
  status: string;
  createdAt?: string;
  totalChargers: number;
  availableConnectors: number;
}

export interface Charger {
  id: number;
  ocppIdentity: string;
  name: string;
  maxPowerKw: number;
  status: string;
  chargerType?: string;
  connectors: Connector[];
}

export interface Connector {
  id: number;
  connectorNo: number;
  type: string;
  maxPowerKw: number;
  status: string;
}

export interface Tariff {
  pricePerKwh: number;
  gstPercent: number;
  platformFeePercent?: number;
  sessionFee: number;
  currency?: string;
}

export interface LiveSession {
  sessionId: number;
  vehicleNumber: string;
  status: string;
  energyConsumedKwh: number;
  baseAmountRs: number;
  gstAmountRs: number;
  gstPercent?: number;
  runningAmountRs: number;
  elapsedSeconds: number;
  currentPowerKw: number;
  meterStart: number;
  latestMeterWh: number;
  startedAt?: string;
  limitType?: string;
  limitValue?: number;
  socPercent?: number | null;
}

export interface BillSummary {
  sessionId: number;
  vehicleNumber: string;
  connectorNo: number;
  energyConsumedKwh: number;
  pricePerKwh: number;
  baseAmount: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  chargedAmount: number;
  preauthAmount: number;
  refundAmount: number;
  paymentMode: string;
  paymentStatus: string;
  startedAt: string;
  endedAt: string;
}

export interface StartSessionRequest {
  chargerId: number;
  connectorId: number;
  connectorNo: number;
  vehicleNumber?: string;
  phoneNumber: string;
  startedBy: 'SELF' | 'OWNER';
  limitType: 'AMOUNT' | 'ENERGY' | 'TIME';
  limitValue: number;
  paymentMode: 'CASH' | 'QR' | 'ONLINE';
}

// Auth Interfaces
export interface CheckPhoneResponse {
  exists: boolean;
  hasPasscode: boolean;
}

export interface SendOtpResponse {
  message: string;
  expiresInSeconds: number;
}

export interface VerifyOtpResponse {
  token: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
  hasPasscode: boolean;
}

export interface LoginPasscodeResponse extends AuthResponse {
  customerId: number;
}

export interface RegisterResponse extends AuthResponse {
  customerId: number;
  name: string;
}
