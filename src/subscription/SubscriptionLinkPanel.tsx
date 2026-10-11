import { useState } from "react";
import { copyToClipboard } from "../support/copyToClipboard";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import type { FirstInvoice } from "./types";

type Props = { firstInvoice: FirstInvoice; onDone: () => void };

// A card subscription without a saved card waits for the payer to register one through this link.
// The gateway hands the link out once, on the create response. It comes from the form's state,
// never from the query cache, and the create mutation is dropped when the form unmounts. A new
// link later is the detail's "Gerar novo link" on the open invoice.
export function SubscriptionLinkPanel({ firstInvoice, onDone }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (await copyToClipboard(firstInvoice.checkout_url)) {
      setCopied(true);
    }
  }

  return (
    <Card>
      <div className="space-y-4">
        <h2 className="font-display text-[15px] font-semibold">Assinatura criada</h2>
        <p className="text-sm text-muted">
          Ela começa quando o pagador cadastrar o cartão. Envie este link: ele só aparece agora.
        </p>

        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs">
            {firstInvoice.checkout_url}
          </code>
          <Button size="sm" onClick={handleCopy}>
            Copiar
          </Button>
          {copied && <span className="text-sm text-ok-fg">Copiado</span>}
        </div>

        <Button onClick={onDone}>Ver assinatura</Button>
      </div>
    </Card>
  );
}
