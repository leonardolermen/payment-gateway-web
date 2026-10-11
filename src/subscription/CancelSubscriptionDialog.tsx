import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { orderKeys } from "../order/orderApi";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { messageFor, provesNothingWasCreated } from "../support/gatewayError";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { cancelSubscription, subscriptionKeys } from "./subscriptionApi";
import { cancelsOnlyNow } from "./subscriptionRules";
import type { Subscription } from "./types";

type Props = { subscription: Subscription; onClose: () => void };

type When = { label: string; atPeriodEnd: boolean; hint: string };

const AT_PERIOD_END: When = {
  label: "No fim do período",
  atPeriodEnd: true,
  hint: "Ela segue até o fim do período já cobrado e não gera nova fatura.",
};

// The gateway cancels the open invoice at the bank before ending the subscription.
const NOW: When = {
  label: "Agora",
  atPeriodEnd: false,
  hint: "Ela termina agora. A fatura em aberto também é cancelada no banco.",
};

// Waiting for the first payment: no bank attempt yet, only the link the payer holds.
const NOW_BEFORE_THE_FIRST_PAYMENT: When = {
  ...NOW,
  hint: "Ela termina agora, e o link da primeira fatura deixa de valer.",
};

function optionsFor(subscription: Subscription): When[] {
  if (subscription.status === "INCOMPLETE") {
    return [NOW_BEFORE_THE_FIRST_PAYMENT];
  }

  return cancelsOnlyNow(subscription) ? [NOW] : [AT_PERIOD_END, NOW];
}

export function CancelSubscriptionDialog({ subscription, onClose }: Props) {
  const queryClient = useQueryClient();
  const onlyNow = cancelsOnlyNow(subscription);
  const options = optionsFor(subscription);
  // The end of the period is the default when there is one: the payer already paid for it.
  const [atPeriodEnd, setAtPeriodEnd] = useState(!onlyNow);

  // One key until a clear answer, as on create: a lost response is retried, not sent anew.
  const idempotencyKey = useIdempotencyKey();

  const cancel = useMutation({
    mutationFn: () =>
      cancelSubscription(subscription.id, { at_period_end: atPeriodEnd }, idempotencyKey.current()),
    onError: (error) => {
      if (provesNothingWasCreated(error)) {
        idempotencyKey.renew();
      }
    },
    onSuccess: async () => {
      idempotencyKey.renew();
      // Canceling now cancels the open invoice too: the orders list must not keep it open.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      ]);
      onClose();
    },
  });

  return (
    <ConfirmDialog
      title={onlyNow ? "Cancelar agora?" : "Cancelar assinatura?"}
      confirmLabel={onlyNow ? "Cancelar agora" : "Cancelar assinatura"}
      pending={cancel.isPending}
      error={cancel.isError ? messageFor(cancel.error) : null}
      onConfirm={() => cancel.mutate()}
      onCancel={onClose}
    >
      <fieldset className="space-y-2 text-sm">
        <legend className="pr-2 text-[10px] font-medium tracking-wider text-muted uppercase">
          Quando
        </legend>
        {options.map((option) => {
          const hintId = `cancel-when-${String(option.atPeriodEnd)}-hint`;

          return (
            <div key={option.label}>
              <label className="[&_input]:accent-accent">
                <input
                  type="radio"
                  name="cancel-when"
                  aria-describedby={hintId}
                  checked={atPeriodEnd === option.atPeriodEnd}
                  onChange={() => setAtPeriodEnd(option.atPeriodEnd)}
                />{" "}
                {option.label}
              </label>
              <p id={hintId} className="pl-5 text-xs text-muted">
                {option.hint}
              </p>
            </div>
          );
        })}
      </fieldset>
    </ConfirmDialog>
  );
}
