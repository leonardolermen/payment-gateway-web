import { useState } from "react";
import { useCan } from "../auth/useCan";
import { Button } from "../support/ui/Button";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { ChangeMethodDialog } from "./ChangeMethodDialog";
import { cancelsOnlyNow, isBillable, mayBeCanceled } from "./subscriptionRules";
import type { Subscription } from "./types";

type Open = "cancel" | "method" | null;

export function SubscriptionActions({ subscription }: { subscription: Subscription }) {
  const mayCancel = useCan("cancel_subscription");
  const mayChangeMethod = useCan("change_subscription_method");
  const [open, setOpen] = useState<Open>(null);

  const showCancel = mayCancel && mayBeCanceled(subscription);
  const showChangeMethod = mayChangeMethod && isBillable(subscription);
  const cancelLabel = cancelsOnlyNow(subscription) ? "Cancelar agora" : "Cancelar assinatura";

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
