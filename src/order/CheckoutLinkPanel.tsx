import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { copyToClipboard } from "../support/copyToClipboard";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { invalidateOrder, rotateCheckoutToken } from "./orderApi";
import type { Order } from "./types";

type Props = { order: Order; initialUrl: string | null };

export function CheckoutLinkPanel({ order, initialUrl }: Props) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);

  const rotateKey = useIdempotencyKey();

  // A second rotate under a fresh key would kill the link just issued; a retry reuses the key.
  const rotate = useMutation({
    mutationFn: () => rotateCheckoutToken(order.id, rotateKey.current()),
    onSuccess: async (rotated) => {
      rotateKey.renew();
      setUrl(rotated.checkout_url);
      setCopied(false);
      await invalidateOrder(queryClient, order.id);
    },
  });

  // A closed order has no payable link; showing one would invite a payment that cannot land.
  if (order.status !== "OPEN") {
    return null;
  }

  async function handleCopy() {
    if (url && (await copyToClipboard(url))) {
      setCopied(true);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-semibold">Link de pagamento</h2>

      {url ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 rounded-xl bg-surface-muted px-3 py-2 text-sm break-all">
            {url}
          </code>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            Copiar
          </Button>
          {copied && <span className="text-sm text-ok-fg">Copiado</span>}
        </div>
      ) : (
        <p className="text-sm text-muted">
          O link só é exibido uma vez. Gere um novo para enviar ao pagador.
        </p>
      )}

      <Button variant="ghost" size="sm" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
        Gerar novo link
      </Button>

      {rotate.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(rotate.error)}
        </p>
      )}
    </Card>
  );
}
