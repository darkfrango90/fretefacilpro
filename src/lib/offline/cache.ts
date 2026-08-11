const CACHE_PREFIX = "frete-facil:v1";

export function readOfflineCache<T>(key: string | null | undefined): T | undefined {
  if (!key || typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${key}`);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeOfflineCache<T>(key: string | null | undefined, value: T): void {
  if (!key || typeof window === "undefined") return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    // Armazenamento indisponível ou cheio: a consulta em memória continua válida.
  }
}
