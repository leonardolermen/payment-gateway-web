import { GatewayRequestError, messageFor } from "../support/gatewayError";
import type { Event } from "./checkoutState";

// A 410 means the order closed under the payer, whatever code the body carries; the reducer only
// knows CHECKOUT_ORDER_CLOSED, so every attempt maps it the same way.
export function failureEvent(error: unknown): Extract<Event, { type: "attempt_failed" }> {
  const isGatewayError = error instanceof GatewayRequestError;
  const isGone = isGatewayError && error.error.status === 410;
  const code = isGatewayError ? error.error.code : "UNKNOWN";

  return {
    type: "attempt_failed",
    code: isGone ? "CHECKOUT_ORDER_CLOSED" : code,
    message: messageFor(error),
  };
}
