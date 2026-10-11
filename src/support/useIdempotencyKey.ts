import { useRef } from "react";
import { provesNothingWasCreated } from "./gatewayError";

/**
 * One Idempotency-Key per user intent, not per click. A request that reached the gateway but whose
 * response was lost (timeout, NetworkError, 5xx) is retried under the SAME key, so the gateway
 * replays it instead of executing it twice. Renew only when the intent is over: success, a refusal
 * that created nothing, or the operator starting over after checking.
 */
export function useIdempotencyKey() {
  const key = useRef<string | null>(null);

  function renew() {
    key.current = null;
  }

  return {
    current(): string {
      key.current ??= crypto.randomUUID();
      return key.current;
    },
    renew,
    // For onError: a 400/422 (other than a reused key) is an answer, and the gateway would replay
    // it under the same key; the corrected request needs a new one.
    renewIfNothingWasCreated(error: unknown) {
      if (provesNothingWasCreated(error)) {
        renew();
      }
    },
  };
}
