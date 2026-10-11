import { useState } from "react";
import { useCan } from "../auth/useCan";
import { Button } from "../support/ui/Button";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { ChangeMethodDialog } from "./ChangeMethodDialog";
import type { Subscription, SubscriptionStatus } from "./types";

// The gateway cancels and changes the method only while it bills (its isBillable); any other
// status, INCOMPLETE included, answers 409 SUBSCRIPTION_NOT_ACTIVE.
const BILLABLE = new Set<SubscriptionStatus>(["ACTIVE", "PAST_DUE"]);

type Open = "cancel" | "method" | null;

export function SubscriptionActions({ subscription }: { subscription: Subscription }) {
  const mayCancel = useCan("cancel_subscription");
  const mayChangeMethod = useCan("change_subscription_method");
  const [open, setOpen] = useState<Open>(null);

  const billable = BILLABLE.has(subscription.status);
  const showCancel = mayCancel && billable;
  const showChangeMethod = mayChangeMethod && billable;
  // Already scheduled for the end of the period (the header says so): only "now" is left.
  const cancelLabel = subscription.cancel_at_period_end ? "Cancelar agora" : "Cancelar assinatura";

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
          {cancelLabel}
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
