import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { invalidateOrder, rotateCheckoutToken } from "../order/orderApi";
import type { Order } from "../order/types";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { copyToClipboard } from "../support/copyToClipboard";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { subscriptionKeys } from "./subscriptionApi";

type Props = { invoice: Order; subscriptionId: string };

type Outcome = { kind: "copied" } | { kind: "shown"; url: string } | { kind: "missing" };

// The gateway never shows a link twice, so a link to copy is a new one: the token rotates and the
// link the payer already holds stops working. Hence the question before it.
export function InvoiceLinkButton({ invoice, subscriptionId }: Props) {
  const queryClient = useQueryClient();
  const rotateKey = useIdempotencyKey();
  const [confirming, setConfirming] = useState(false);
  // Held here and nowhere else; a URL only when the clipboard refused it, for a manual copy.
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // A second rotate under a fresh key would kill the link just issued; a retry reuses the key.
  const rotate = useMutation({
    // The result holds no link: a rotated link is handed out once and must not sit in the
    // mutation cache for as long as the row is on screen.
    mutationFn: async () => {
      const rotated = await rotateCheckoutToken(invoice.id, rotateKey.current());
      rotateKey.renew();

      const url = rotated.checkout_url;
      if (url === null) {
        setOutcome({ kind: "missing" });
        return;
      }

      const copied = await copyToClipboard(url);
      setOutcome(copied ? { kind: "copied" } : { kind: "shown", url });
    },
    gcTime: 0,
    // A line saying "copiado" next to a fresh error would tell two stories.
    onMutate: () => setOutcome(null),
    onSettled: () => setConfirming(false),
    onSuccess: () =>
      Promise.all([
        invalidateOrder(queryClient, invoice.id),
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.orders(subscriptionId) }),
      ]),
  });

  function ask() {
    rotate.reset();
    setConfirming(true);
  }

  return (
    <div className="space-y-1">
      <Button variant="ghost" size="sm" disabled={rotate.isPending} onClick={ask}>
        Gerar novo link
      </Button>

      {outcome?.kind === "copied" && (
        <p role="status" className="text-xs text-ok-fg">
          Link novo copiado. O anterior deixa de valer.
        </p>
      )}

      {outcome?.kind === "shown" && (
        <div className="space-y-1">
          <p className="text-xs text-muted">Não deu para copiar. O link novo é este:</p>
          <code className="block max-w-64 truncate rounded-lg bg-surface-muted px-2 py-1 font-mono text-xs">
            {outcome.url}
          </code>
        </div>
      )}

      {outcome?.kind === "missing" && (
        <p role="alert" className="text-xs text-danger">
          O link anterior foi invalidado, mas o novo não veio. Tente de novo.
        </p>
      )}

      {rotate.isError && (
        <p role="alert" className="text-xs text-danger">
          {messageFor(rotate.error)}
        </p>
      )}

      {confirming && (
        <ConfirmDialog
          title="Gerar e copiar um link novo?"
          confirmLabel="Gerar e copiar"
          pending={rotate.isPending}
          error={null}
          onConfirm={() => rotate.mutate()}
          onCancel={() => setConfirming(false)}
        >
          <p className="text-sm text-muted">O link que o pagador já tem deixa de valer.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
