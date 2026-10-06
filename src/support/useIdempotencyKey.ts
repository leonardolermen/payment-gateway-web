import { useRef } from "react";

/**
 * One Idempotency-Key per user intent, not per click. A request that reached the gateway but whose
 * response was lost (timeout, NetworkError, 5xx) is retried under the SAME key, so the gateway
 * replays it instead of executing it twice. Renew only when the intent is over: success, dialog
 * closed, or the payload changed.
 */
export function useIdempotencyKey() {
  const key = useRef<string | null>(null);

  return {
    current(): string {
      key.current ??= crypto.randomUUID();
      return key.current;
    },
    renew() {
      key.current = null;
    },
  };
}
