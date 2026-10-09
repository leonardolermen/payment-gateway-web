import { useEffect, useState } from "react";
import { copyToClipboard } from "../../support/copyToClipboard";
import { Button } from "../../support/ui/Button";
import { Card } from "../../support/ui/Card";

const COPIED_FOR_MS = 2000;

export function WebhookUrlCard({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(text: string) {
    setCopied(await copyToClipboard(text));
  }

  return (
    <Card className="space-y-3">
      <h3 className="font-semibold">Webhook de entrada</h3>
      {url === null ? (
        <p className="text-sm text-muted">
          O webhook de entrada está desligado neste gateway (porta mTLS 0).
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 rounded-lg border border-line bg-field px-3 py-2 font-mono text-xs break-all">
              {url}
            </code>
            <Button variant="ghost" size="sm" onClick={() => copy(url)}>
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Cadastre esta URL no portal do Itaú para receber as notificações de Pix e boleto.
          </p>
        </>
      )}
    </Card>
  );
}
