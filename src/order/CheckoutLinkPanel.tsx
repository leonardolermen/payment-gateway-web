import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useCan } from "../auth/useCan";
import { copyToClipboard } from "../support/copyToClipboard";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { invalidateOrder, rotateCheckoutToken } from "./orderApi";
import type { Order } from "./types";

// The order's other actions share the link's button row, as in the mockup; they still show when
// the order is closed and the link is not.
type Props = { order: Order; initialUrl: string | null; children?: ReactNode };

export function CheckoutLinkPanel({ order, initialUrl, children }: Props) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);
  const canRotate = useCan("rotate_checkout_link");

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
    return children ?? null;
  }

  async function handleCopy() {
    if (url && (await copyToClipboard(url))) {
      setCopied(true);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[10px] font-medium tracking-wider text-muted uppercase">
        Link de pagamento
      </h2>

      {url ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs">
            {url}
          </code>
          <Button size="sm" onClick={handleCopy}>
            Copiar
          </Button>
          {copied && <span className="text-sm text-ok-fg">Copiado</span>}
        </div>
      ) : (
        <p className="text-sm text-muted">
          O link só é exibido uma vez. Gere um novo para enviar ao pagador.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canRotate && (
          <Button
            variant="ghost"
            size="sm"
            disabled={rotate.isPending}
            onClick={() => rotate.mutate()}
          >
            Gerar novo link
          </Button>
        )}
        {children}
      </div>

      {rotate.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(rotate.error)}
        </p>
      )}
    </div>
  );
}
