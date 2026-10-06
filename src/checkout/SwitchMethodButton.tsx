import { useState } from "react";
import { messageFor } from "../support/gatewayError";
import { cancelAttempt } from "./checkoutApi";
import type { Event } from "./checkoutState";

type Props = { token: string; paymentId: string; send: (event: Event) => void };

// Cancels on the server first: going back to the chooser while the old Pix stays payable would let
// the payer pay twice.
export function SwitchMethodButton({ token, paymentId, send }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  async function switchMethod() {
    setIsCancelling(true);
    try {
      await cancelAttempt(token, paymentId);
      send({ type: "cancelled" });
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={isCancelling}
        className="text-sm text-muted underline underline-offset-2 hover:text-ink"
        onClick={() => void switchMethod()}
      >
        Trocar de método
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
