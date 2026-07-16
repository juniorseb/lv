import { API_BASE_URL } from '../config';

// Erreur d'API portant le code HTTP et le message renvoyé par le backend
// (les messages Livrechap sont rédigés pour être affichables tels quels).
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
}

// Appel HTTP bas niveau. Sérialise le corps en JSON, injecte le jeton Bearer si
// fourni, et transforme les erreurs en ApiError avec un message lisible.
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    // Panne réseau / serveur injoignable.
    throw new ApiError(
      0,
      'Connexion impossible. Vérifiez votre réseau et réessayez.',
    );
  }

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, response.status));
  }

  return payload as T;
}

// Les exceptions NestJS renvoient { message: string | string[] }. On aplatit en
// une chaîne affichable.
function extractMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) {
      return message.join('\n');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return `Une erreur est survenue (${status}).`;
}
