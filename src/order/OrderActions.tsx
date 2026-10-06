import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { messageFor } from "../support/gatewayError";
import { cancelOrder, invalidateOrder, refundPayment } from "./orderApi";
import { RefundDialog } from "./RefundDialog";
import type { Order, Payment } from "./types";

type Props = { order: Order; attempts: Payment[] };

type Open = "cancel" | "refund" | null;

export function OrderActions({ order, attempts }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<Open>(null);

  const completed = attempts.find((attempt) => attempt.status === "COMPLETED");
  const refundable = completed
    ? (completed.paid_amount ?? completed.amount) - (completed.refunded_amount ?? 0)
    : 0;

  const cancel = useMutation({
    mutationFn: () => cancelOrder(order.id, crypto.randomUUID()),
    onSuccess: async () => {
      setOpen(null);
      await invalidateOrder(queryClient, order.id);
    },
  });

  const refund = useMutation({
    mutationFn: (amount: number | undefined) =>
      refundPayment(completed?.id ?? "", amount, crypto.randomUUID()),
    onSuccess: async () => {
      setOpen(null);
      await invalidateOrder(queryClient, order.id);
    },
  });

  function close() {
    setOpen(null);
    cancel.reset();
    refund.reset();
  }

  return (
    <div className="flex gap-2">
      {order.status === "OPEN" && (
        <button
          type="button"
          onClick={() => setOpen("cancel")}
          className="rounded border px-3 py-1 text-sm"
        >
          Cancelar cobrança
        </button>
      )}

      {completed && refundable > 0 && (
        <button
          type="button"
          onClick={() => setOpen("refund")}
          className="rounded border px-3 py-1 text-sm"
        >
          Reembolsar
        </button>
      )}

      {open === "cancel" && (
        <ConfirmDialog
          title="Cancelar cobrança?"
          confirmLabel="Confirmar"
          pending={cancel.isPending}
          error={cancel.isError ? messageFor(cancel.error) : null}
          onConfirm={() => cancel.mutate()}
          onCancel={close}
        />
      )}

      {open === "refund" && (
        <RefundDialog
          maxCents={refundable}
          pending={refund.isPending}
          error={refund.isError ? messageFor(refund.error) : null}
          onConfirm={(amount) => refund.mutate(amount)}
          onCancel={close}
        />
      )}
    </div>
  );
}
