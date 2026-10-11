import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { invalidateOrder, rotateCheckoutToken } from "../order/orderApi";
import type { Order } from "../order/types";
import { copyToClipboard } from "../support/copyToClipboard";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { subscriptionKeys } from "./subscriptionApi";

type Props = { invoice: Order; subscriptionId: string };

type Outcome = { copied: true } | { copied: false; url: string | null };

// The gateway never shows a link twice, so "copiar" is the order's "gerar novo link": the token
// rotates and the link the payer already holds stops working.
export function InvoiceLinkButton({ invoice, subscriptionId }: Props) {
  const queryClient = useQueryClient();
  const rotateKey = useIdempotencyKey();
  // Only when the clipboard refused it: the link is then shown for a manual copy, held here and
  // nowhere else.
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // A second rotate under a fresh key would kill the link just issued; a retry reuses the key.
  const rotate = useMutation({
    mutationFn: async () => {
      const rotated = await rotateCheckoutToken(invoice.id, rotateKey.current());
      rotateKey.renew();
      const url = rotated.checkout_url;
      const copied = url !== null && (await copyToClipboard(url));

      // The mutation result holds no link: a rotated link is handed out once and must not sit in
      // the mutation cache for as long as the row is on screen.
      setOutcome(copied ? { copied } : { copied, url });
    },
    gcTime: 0,
    onSuccess: () =>
      Promise.all([
        invalidateOrder(queryClient, invoice.id),
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.orders(subscriptionId) }),
      ]),
  });

  return (
    <div className="space-y-1">
      <Button variant="ghost" size="sm" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
        Copiar link
      </Button>

      {outcome?.copied && (
        <p role="status" className="text-xs text-ok-fg">
          Link novo copiado. O anterior deixa de valer.
        </p>
      )}

      {outcome?.copied === false && outcome.url && (
        <div className="space-y-1">
          <p className="text-xs text-muted">Não deu para copiar. O link novo é este:</p>
          <code className="block max-w-64 truncate rounded-lg bg-surface-muted px-2 py-1 font-mono text-xs">
            {outcome.url}
          </code>
        </div>
      )}

      {rotate.isError && (
        <p role="alert" className="text-xs text-danger">
          {messageFor(rotate.error)}
        </p>
      )}
    </div>
  );
}
