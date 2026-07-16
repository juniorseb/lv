import { create } from 'zustand';

import { apiRequest } from '../api/client';
import {
  AuthResult,
  AuthTokens,
  RequestOtpResult,
  User,
  UserRole,
} from '../api/types';
import { secureStorage, SESSION_KEYS } from './secureStorage';

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;

  // Restaure la session depuis le stockage sécurisé au démarrage.
  hydrate: () => Promise<void>;
  // Étape 1 : demande un code OTP.
  requestOtp: (phoneNumber: string) => Promise<RequestOtpResult>;
  // Étape 2 : vérifie le code, ouvre la session. Renvoie true si nouveau compte.
  verifyOtp: (phoneNumber: string, code: string) => Promise<boolean>;
  // Renouvelle l'access token ; renvoie le nouveau jeton ou null si échec.
  refresh: () => Promise<string | null>;
  setUser: (user: User) => void;
  // Recharge l'utilisateur depuis le serveur (rôles, activeRole à jour).
  refreshUser: () => Promise<void>;
  // Change le rôle affiché au lancement (persisté serveur + local).
  setActiveRole: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  accessToken: null,
  refreshToken: null,
  user: null,

  hydrate: async () => {
    const [accessToken, refreshToken, userJson] = await Promise.all([
      secureStorage.getItem(SESSION_KEYS.accessToken),
      secureStorage.getItem(SESSION_KEYS.refreshToken),
      secureStorage.getItem(SESSION_KEYS.user),
    ]);

    if (accessToken && refreshToken) {
      const user = userJson ? (JSON.parse(userJson) as User) : null;
      set({ accessToken, refreshToken, user });
      // Recharge l'utilisateur pour disposer de activeRole/roles à jour (le cache
      // local peut dater d'avant l'ajout de ces champs) — sinon on garde le cache.
      try {
        const fresh = await apiRequest<User>('/users/me', { token: accessToken });
        await secureStorage.setItem(SESSION_KEYS.user, JSON.stringify(fresh));
        set({ status: 'authenticated', user: fresh });
      } catch {
        set({ status: 'authenticated' });
      }
    } else {
      set({ status: 'unauthenticated' });
    }
  },

  requestOtp: (phoneNumber: string) =>
    apiRequest<RequestOtpResult>('/auth/otp/request', {
      method: 'POST',
      body: { phoneNumber },
    }),

  verifyOtp: async (phoneNumber: string, code: string) => {
    const result = await apiRequest<AuthResult>('/auth/otp/verify', {
      method: 'POST',
      body: { phoneNumber, code },
    });
    await persistSession(result);
    set({
      status: 'authenticated',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
    return result.isNewUser;
  },

  refresh: async () => {
    const { refreshToken } = get();
    if (!refreshToken) {
      await get().logout();
      return null;
    }
    try {
      const tokens = await apiRequest<AuthTokens>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      await Promise.all([
        secureStorage.setItem(SESSION_KEYS.accessToken, tokens.accessToken),
        secureStorage.setItem(SESSION_KEYS.refreshToken, tokens.refreshToken),
      ]);
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      return tokens.accessToken;
    } catch {
      // Refresh token invalide/expiré : on ferme la session.
      await get().logout();
      return null;
    }
  },

  setUser: (user: User) => {
    set({ user });
    void secureStorage.setItem(SESSION_KEYS.user, JSON.stringify(user));
  },

  refreshUser: async () => {
    const token = get().accessToken;
    if (!token) return;
    try {
      const fresh = await apiRequest<User>('/users/me', { token });
      get().setUser(fresh);
    } catch {
      // best-effort
    }
  },

  setActiveRole: async (role: UserRole) => {
    const token = get().accessToken;
    if (!token) return;
    const updated = await apiRequest<User>('/users/me/active-role', {
      method: 'PATCH',
      body: { activeRole: role },
      token,
    });
    get().setUser(updated);
  },

  logout: async () => {
    await Promise.all([
      secureStorage.removeItem(SESSION_KEYS.accessToken),
      secureStorage.removeItem(SESSION_KEYS.refreshToken),
      secureStorage.removeItem(SESSION_KEYS.user),
    ]);
    set({
      status: 'unauthenticated',
      accessToken: null,
      refreshToken: null,
      user: null,
    });
  },
}));

async function persistSession(result: AuthResult): Promise<void> {
  await Promise.all([
    secureStorage.setItem(SESSION_KEYS.accessToken, result.accessToken),
    secureStorage.setItem(SESSION_KEYS.refreshToken, result.refreshToken),
    secureStorage.setItem(SESSION_KEYS.user, JSON.stringify(result.user)),
  ]);
}
