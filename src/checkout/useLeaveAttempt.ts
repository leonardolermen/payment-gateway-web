import { useCallback, useState } from "react";
import { messageFor } from "../support/gatewayError";
import { cancelAttempt } from "./checkoutApi";
import type { Event } from "./checkoutState";

/**
 * Leaving a Pix or boleto cancels it on the server first: going back to the chooser while the old
 * charge stays payable would let the payer pay twice. Resolves whether the payer actually left.
 */
export function useLeaveAttempt(token: string, send: (event: Event) => void) {
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const leave = useCallback(
    async (paymentId: string): Promise<boolean> => {
      setIsLeaving(true);
      setError(null);
      try {
        await cancelAttempt(token, paymentId);
        send({ type: "cancelled" });
        return true;
      } catch (e) {
        setError(messageFor(e));
        return false;
      } finally {
        setIsLeaving(false);
      }
    },
    [token, send],
  );

  return { leave, isLeaving, error, clearError: () => setError(null) };
}
