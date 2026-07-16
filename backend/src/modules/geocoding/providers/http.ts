// Appel HTTP JSON avec délai maximal : un fournisseur de geocoding lent ne doit
// jamais bloquer la requête du mobile — on abandonne et on passe au suivant.
export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number,
  headers: Record<string, string> = {},
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Réseau coupé, timeout, JSON invalide : traité comme « pas de résultat ».
    return null;
  } finally {
    clearTimeout(timer);
  }
}
