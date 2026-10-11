import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TextField } from "../customer/TextField";
import { chargeSavedCard, invalidateOrder } from "../order/orderApi";
import type { Order } from "../order/types";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { messageFor, provesNothingWasCreated } from "../support/gatewayError";
import { formatBrl } from "../support/money";
import { Button } from "../support/ui/Button";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { SavedCardName } from "./SavedCardName";
import { subscriptionKeys } from "./subscriptionApi";

type Props = { invoice: Order; cardId: string };

const CVV = /^\d{3,4}$/;

export function ChargeAgainButton({ invoice, cardId }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Typed for this charge only: component state, cleared when the dialog closes.
  const [cvv, setCvv] = useState("");
  const [sent, setSent] = useState(false);

  // Owned by the row, not the dialog: closing and reopening after a lost response must replay the
  // same attempt, not authorize the card a second time. Renewed only on a clear answer.
  const chargeKey = useIdempotencyKey();

  const charge = useMutation({
    mutationFn: () => chargeSavedCard(invoice.id, { card_id: cardId, cvv }, chargeKey.current()),
    // No variables: the CVV is read from state, so the mutation cache never holds it.
    gcTime: 0,
    onError: (error) => {
      if (provesNothingWasCreated(error)) {
        chargeKey.renew();
      }
    },
    onSuccess: async () => {
      chargeKey.renew();
      close();
      setSent(true);
      await Promise.all([
        invalidateOrder(queryClient, invoice.id),
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
      ]);
    },
  });

  function close() {
    setOpen(false);
    setCvv("");
    charge.reset();
  }

  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setSent(false);
          setOpen(true);
        }}
      >
        Cobrar de novo
      </Button>

      {sent && (
        <p role="status" className="text-xs text-muted">
          Tentativa enviada; o status da fatura muda quando ela concluir.
        </p>
      )}

      {open && (
        <ConfirmDialog
          title="Cobrar de novo?"
          confirmLabel="Cobrar"
          pending={charge.isPending}
          confirmDisabled={!CVV.test(cvv)}
          error={charge.isError ? messageFor(charge.error) : null}
          onConfirm={() => charge.mutate()}
          onCancel={close}
        >
          <p className="text-sm text-muted">
            Cobra {formatBrl(invoice.amount)} no cartão salvo <SavedCardName cardId={cardId} />.
          </p>
          {/* The gateway requires the security code with a saved card on an order attempt. */}
          <TextField
            label="CVV"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={cvv}
            onChange={(event) => setCvv(event.target.value.replace(/\D/g, ""))}
          />
        </ConfirmDialog>
      )}
    </div>
  );
}
