import { useState } from "react";
import { useCan } from "../auth/useCan";
import { Button } from "../support/ui/Button";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { ChangeMethodDialog } from "./ChangeMethodDialog";
import type { Subscription, SubscriptionStatus } from "./types";

// Over for good: nothing left to cancel. An INCOMPLETE one may still be dropped before it starts.
const CLOSED = new Set<SubscriptionStatus>(["CANCELED", "ENDED", "INCOMPLETE_EXPIRED"]);

// The gateway changes the method only while it bills (409 SUBSCRIPTION_NOT_ACTIVE otherwise).
const BILLABLE = new Set<SubscriptionStatus>(["ACTIVE", "PAST_DUE"]);

type Open = "cancel" | "method" | null;

export function SubscriptionActions({ subscription }: { subscription: Subscription }) {
  const mayCancel = useCan("cancel_subscription");
  const mayChangeMethod = useCan("change_subscription_method");
  const [open, setOpen] = useState<Open>(null);

  // Already scheduled to end: the header says so, and a second cancel would only add a 409.
  const showCancel =
    mayCancel && !CLOSED.has(subscription.status) && !subscription.cancel_at_period_end;
  const showChangeMethod = mayChangeMethod && BILLABLE.has(subscription.status);

  if (!showCancel && !showChangeMethod && open === null) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showChangeMethod && (
        <Button variant="ghost" size="sm" onClick={() => setOpen("method")}>
          Trocar método
        </Button>
      )}

      {showCancel && (
        <Button variant="danger-ghost" size="sm" onClick={() => setOpen("cancel")}>
          Cancelar assinatura
        </Button>
      )}

      {open === "method" && (
        <ChangeMethodDialog subscription={subscription} onClose={() => setOpen(null)} />
      )}

      {open === "cancel" && (
        <CancelSubscriptionDialog subscription={subscription} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
