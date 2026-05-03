import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/endpoints';

const TOKEN_STORAGE_KEY = 'authToken';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Add Bearer token to requests if available
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return config;
});

function extractApiError(error: unknown, fallbackMessage: string): Error {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as { error?: string; message?: string } | undefined;
    const message = responseData?.error || responseData?.message || error.message || fallbackMessage;
    return new Error(message);
  }

  return error instanceof Error ? error : new Error(fallbackMessage);
}

/**
 * STEP 1: Check if phone exists and whether user has a passcode
 */
export async function checkPhone(phoneNumber: string) {
  const response = await api.post('/api/customer/auth/check-phone', {
    phoneNumber,
  });
  return response.data;
}

/**
 * Send OTP for various purposes: LOGIN, REGISTER, RESET_PASSCODE
 */
export async function sendOtp(
  phoneNumber: string,
  purpose: 'LOGIN' | 'REGISTER' | 'RESET_PASSCODE'
) {
  try {
    const response = await api.post('/api/customer/auth/send-otp', {
      phoneNumber,
      purpose,
    });
    return response.data;
  } catch (error) {
    throw extractApiError(error, 'Failed to send OTP');
  }
}

/**
 * Verify OTP and get token
 */
export async function verifyOtp(
  phoneNumber: string,
  otp: string,
  purpose: 'LOGIN' | 'REGISTER' | 'RESET_PASSCODE'
) {
  try {
    const response = await api.post('/api/customer/auth/verify-otp', {
      phoneNumber,
      otp,
      purpose,
    });
    return response.data;
  } catch (error) {
    throw extractApiError(error, 'Failed to verify OTP');
  }
}

/**
 * Login with passcode (existing user with passcode)
 */
export async function loginPasscode(phoneNumber: string, passcode: string) {
  const response = await api.post('/api/customer/auth/login-passcode', {
    phoneNumber,
    passcode,
  });

  if (response.data?.token) {
    const token = `${response.data.tokenType ?? 'Bearer'} ${response.data.token}`;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  return response.data;
}

/**
 * Login with OTP (existing user without passcode)
 */
export async function loginOtp(phoneNumber: string, otpToken: string) {
  const response = await api.post('/api/customer/auth/login-otp', {
    phoneNumber,
    otpToken,
  });

  if (response.data?.token) {
    const token = `${response.data.tokenType ?? 'Bearer'} ${response.data.token}`;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  return response.data;
}

/**
 * Register new user
 */
export async function register(
  phoneNumber: string,
  name: string,
  otpToken: string
) {
  const response = await api.post('/api/customer/auth/register', {
    phoneNumber,
    name,
    otpToken,
  });

  if (response.data?.token) {
    const token = `${response.data.tokenType ?? 'Bearer'} ${response.data.token}`;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  return response.data;
}

/**
 * Set or update passcode
 * If otpToken is provided, this is a passcode reset; otherwise it's setting a new passcode
 */
export async function setPasscode(
  phoneNumber: string,
  passcode: string,
  otpToken: string = ''
) {
  const payload: Record<string, string> = {
    phoneNumber,
    passcode,
  };

  if (otpToken) {
    payload.otpToken = otpToken;
  }

  const response = await api.post('/api/customer/auth/set-passcode', payload);
  return response.data;
}

export default api;

// ==================== OWNER AUTH ====================

const OWNER_TOKEN_STORAGE_KEY = 'ownerAuthToken';

/**
 * Authenticate owner with mobile number and PIN
 */
export async function ownerAuth(mobileNumber: string, pin: string) {
  const response = await api.post('/api/owner/auth', {
    mobileNumber,
    pin,
  });

  if (response.data?.token) {
    const token = `${response.data.tokenType ?? 'Bearer'} ${response.data.token}`;
    localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, token);
  }

  return response.data;
}

/**
 * Clear owner session
 */
export function clearOwnerSession() {
  localStorage.removeItem(OWNER_TOKEN_STORAGE_KEY);
}

/**
 * Get stored owner token
 */
export function getOwnerToken(): string | null {
  return localStorage.getItem(OWNER_TOKEN_STORAGE_KEY);
}
