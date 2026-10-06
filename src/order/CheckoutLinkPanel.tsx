import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { copyToClipboard } from "../support/copyToClipboard";
import { messageFor } from "../support/gatewayError";
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
    <div className="space-y-2">
      <h2 className="font-medium">Link de pagamento</h2>

      {url ? (
        <div className="flex items-center gap-2">
          <code className="break-all text-sm">{url}</code>
          <button type="button" onClick={handleCopy} className="rounded border px-2 py-1 text-sm">
            Copiar
          </button>
          {copied && <span className="text-sm text-green-700">Copiado</span>}
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          O link só é exibido uma vez. Gere um novo para enviar ao pagador.
        </p>
      )}

      <button
        type="button"
        disabled={rotate.isPending}
        onClick={() => rotate.mutate()}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        Gerar novo link
      </button>

      {rotate.isError && (
        <p role="alert" className="text-sm text-red-700">
          {messageFor(rotate.error)}
        </p>
      )}
    </div>
  );
}
