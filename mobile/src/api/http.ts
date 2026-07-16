import { useAuthStore } from '../store/authStore';
import { apiRequest, ApiError, RequestOptions } from './client';

// Appel API authentifié : injecte l'access token courant et, en cas de 401,
// tente un rafraîchissement puis rejoue la requête une fois. C'est le point
// d'entrée des modules API métier (livraisons, portefeuille, etc.).
export async function authedRequest<T>(
  path: string,
  options: Omit<RequestOptions, 'token'> = {},
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  try {
    return await apiRequest<T>(path, {
      ...options,
      token: accessToken ?? undefined,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const newToken = await useAuthStore.getState().refresh();
      if (newToken) {
        return apiRequest<T>(path, { ...options, token: newToken });
      }
    }
    throw error;
  }
}
