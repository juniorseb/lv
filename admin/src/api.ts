import {
  AdminDriver,
  AdminDriverDocument,
  AdminSosAlert,
  AdminStats,
  AdminUser,
  DocumentStatus,
  DriverStatus,
  PendingUser,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'lc_admin_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function setToken(value: string | null): void {
  token = value;
  if (value) {
    localStorage.setItem(TOKEN_KEY, value);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken(): string | null {
  return token;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Connexion impossible au serveur.');
  }

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message = extractMessage(payload) ?? `Erreur ${response.status}.`;
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

function extractMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) return message.join('\n');
    if (typeof message === 'string') return message;
  }
  return null;
}

// --- Auth (OTP, réservé aux comptes administrateurs) ---------------------

export const authApi = {
  requestOtp: (phoneNumber: string) =>
    request<{ phoneNumber: string; message: string }>('/auth/otp/request', {
      method: 'POST',
      body: { phoneNumber },
      auth: false,
    }),
  verifyOtp: (phoneNumber: string, code: string) =>
    request<{ accessToken: string; user: AdminUser }>('/auth/otp/verify', {
      method: 'POST',
      body: { phoneNumber, code },
      auth: false,
    }),
  me: () => request<AdminUser>('/auth/me'),
};

// --- Back-office ---------------------------------------------------------

export const adminApi = {
  stats: () => request<AdminStats>('/admin/stats'),
  pending: () => request<PendingUser[]>('/admin/verifications/pending'),
  verify: (id: string) =>
    request<PendingUser>(`/admin/users/${id}/verify`, { method: 'POST' }),
  reject: (id: string) =>
    request<PendingUser>(`/admin/users/${id}/reject`, { method: 'POST' }),
  // Livreurs (validation / suivi)
  drivers: () => request<AdminDriver[]>('/admin/drivers'),
  setDriverStatus: (id: string, status: DriverStatus) =>
    request<AdminDriver>(`/admin/drivers/${id}/status`, {
      method: 'POST',
      body: { status },
    }),
  setDocumentStatus: (id: string, status: DocumentStatus) =>
    request<AdminDriverDocument>(`/admin/documents/${id}/status`, {
      method: 'POST',
      body: { status },
    }),
  // Livrechap Protect (SOS) — alertes actives + résolution.
  sos: () => request<AdminSosAlert[]>('/admin/sos'),
  resolveSos: (id: string) =>
    request<AdminSosAlert>(`/admin/sos/${id}/resolve`, { method: 'POST' }),
};
