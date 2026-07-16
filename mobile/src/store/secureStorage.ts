import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Stockage des jetons de session.
//  - Natif (iOS/Android) : expo-secure-store (chiffré par l'OS).
//  - Web : expo-secure-store n'existe pas → repli sur localStorage.
// On enveloppe pour centraliser les clés et neutraliser les erreurs de lecture.

const ACCESS_TOKEN_KEY = 'lc_access_token';
const REFRESH_TOKEN_KEY = 'lc_refresh_token';
const USER_KEY = 'lc_user';

const isWeb = Platform.OS === 'web';

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (isWeb) {
        return globalThis.localStorage?.getItem(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (isWeb) {
        globalThis.localStorage?.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Rien à supprimer : on ignore.
    }
  },
};

export const SESSION_KEYS = {
  accessToken: ACCESS_TOKEN_KEY,
  refreshToken: REFRESH_TOKEN_KEY,
  user: USER_KEY,
};
