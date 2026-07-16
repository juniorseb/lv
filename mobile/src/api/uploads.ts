import { API_BASE_URL } from '../config';
import { useAuthStore } from '../store/authStore';
import { ApiError } from './client';

// Téléverse une image locale (URI) vers /uploads et renvoie son URL publique.
// Multipart (donc hors du client JSON) : on gère l'auth et un refresh sur 401.
export async function uploadImage(uri: string): Promise<string> {
  const send = (token: string | null): Promise<Response> => {
    const form = new FormData();
    const name = uri.split('/').pop() ?? 'photo.jpg';
    // React Native accepte cette forme de "fichier" dans FormData.
    form.append('file', {
      uri,
      name,
      type: guessMimeType(name),
    } as unknown as Blob);

    return fetch(`${API_BASE_URL}/uploads`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  };

  let token = useAuthStore.getState().accessToken;
  let response = await send(token);
  if (response.status === 401) {
    token = await useAuthStore.getState().refresh();
    if (token) {
      response = await send(token);
    }
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractMessage(payload) ?? 'Échec du téléversement.',
    );
  }
  return (payload as { url: string }).url;
}

function guessMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

function extractMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) return message.join('\n');
    if (typeof message === 'string') return message;
  }
  return null;
}
