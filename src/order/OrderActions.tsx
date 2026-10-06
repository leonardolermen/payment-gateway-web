import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { messageFor } from "../support/gatewayError";
import { cancelOrder, invalidateOrder, listAttempts, orderKeys, refundPayment } from "./orderApi";
import { RefundDialog } from "./RefundDialog";
import type { Order, Payment } from "./types";

type Props = { order: Order; attempts: Payment[] };

const REFUND_LOCK_MS = 120_000;

type Open ="cancel" | "refund" | null;

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

  // Refunds settle asynchronously (202): refunded_amount changes later. Until it does, offering
  // the button again would let a second full refund go out under a fresh key. Component state
  // only: nothing is persisted, a reload simply trusts the server's refunded_amount.
  const [lock, setLock] = useState<{ paymentId: string; baseline: number } | null>(null);
  const locked =
    lock !== null &&
    completed?.id === lock.paymentId &&
    (completed.refunded_amount ?? 0) === lock.baseline;

  useEffect(() => {
    if (!lock) {
      return;
    }
    const timer = setTimeout(() => setLock(null), REFUND_LOCK_MS);
    return () => clearTimeout(timer);
  }, [lock]);

  // Shares the page's cache entry; this only adds a poll while the lock is held.
  useQuery({
    queryKey: orderKeys.attempts(order.id),
    queryFn: () => listAttempts(order.id),
    enabled: locked,
    refetchInterval: locked ? 5_000 : false,
  });

  const refund = useMutation({
    mutationFn: (amount: number | undefined) =>
      refundPayment(completed?.id ?? "", amount, crypto.randomUUID()),
    onSuccess: async () => {
      if (completed) {
        setLock({ paymentId: completed.id, baseline: completed.refunded_amount ?? 0 });
      }
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

      {locked && <span className="text-sm text-gray-600">Reembolso em processamento</span>}

      {completed && refundable > 0 && !locked && (
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
