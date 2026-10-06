export const KEY = "gateway.apiKey";

// sessionStorage, not localStorage: the key dies with the tab until scoped keys exist.
// Every access is guarded because private modes and blocked storage throw instead of returning null.
export function readApiKey(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeApiKey(key: string): void {
  try {
    window.sessionStorage.setItem(KEY, key.trim());
  } catch {
    // Without storage the user simply logs in again on the next load.
  }
}

export function clearApiKey(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
