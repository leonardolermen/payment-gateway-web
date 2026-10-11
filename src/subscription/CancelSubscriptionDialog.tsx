import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { messageFor, provesNothingWasCreated } from "../support/gatewayError";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { cancelSubscription, subscriptionKeys } from "./subscriptionApi";
import type { Subscription } from "./types";

type Props = { subscription: Subscription; onClose: () => void };

const WHEN: { label: string; atPeriodEnd: boolean; hint: string }[] = [
  {
    label: "No fim do período",
    atPeriodEnd: true,
    hint: "Ela segue até o fim do período já cobrado e não gera nova fatura.",
  },
  { label: "Agora", atPeriodEnd: false, hint: "Ela termina agora, sem esperar o fim do período." },
];

export function CancelSubscriptionDialog({ subscription, onClose }: Props) {
  const queryClient = useQueryClient();
  // The end of the period is the default: the payer already paid for it.
  const [atPeriodEnd, setAtPeriodEnd] = useState(true);

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
      await queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      onClose();
    },
  });

  return (
    <ConfirmDialog
      title="Cancelar assinatura?"
      confirmLabel="Cancelar assinatura"
      pending={cancel.isPending}
      error={cancel.isError ? messageFor(cancel.error) : null}
      onConfirm={() => cancel.mutate()}
      onCancel={onClose}
    >
      <fieldset className="space-y-2 text-sm">
        <legend className="pr-2 text-[10px] font-medium tracking-wider text-muted uppercase">
          Quando
        </legend>
        {WHEN.map((option) => {
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
