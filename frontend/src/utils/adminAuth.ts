export type AdminSession = {
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | string;
};

const ADMIN_TOKEN_KEY = 'adminAuthToken';
const ADMIN_PROFILE_KEY = 'adminProfile';

export function saveAdminSession(token: string, session: AdminSession): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_PROFILE_KEY);
}

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAdminSession(): AdminSession | null {
  const value = localStorage.getItem(ADMIN_PROFILE_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AdminSession;
  } catch {
    return null;
  }
}

export function isSuperAdmin(): boolean {
  return getAdminSession()?.role === 'SUPER_ADMIN';
}
