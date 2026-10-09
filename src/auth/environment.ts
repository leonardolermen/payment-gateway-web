export type Environment = "TEST" | "LIVE";

export const ENVIRONMENT_KEY = "gateway.environment";

// A per-viewer convenience, not a secret: which environment the panel shows. Guarded like theme.ts,
// because private modes throw instead of returning null.
export function readEnvironment(): Environment {
  try {
    return window.localStorage.getItem(ENVIRONMENT_KEY) === "LIVE" ? "LIVE" : "TEST";
  } catch {
    return "TEST";
  }
}

const listeners = new Set<() => void>();

export function onEnvironmentChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function storeEnvironment(environment: Environment): void {
  try {
    window.localStorage.setItem(ENVIRONMENT_KEY, environment);
  } catch {
    // Without storage the choice simply does not survive a reload.
  }

  listeners.forEach((listener) => listener());
}
