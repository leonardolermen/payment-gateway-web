import { useState } from "react";
import { copyToClipboard } from "../support/copyToClipboard";
import { Button } from "../support/ui/Button";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    setCopied(await copyToClipboard(text));
  }

  return (
    <Button size="lg" onClick={() => void copy()}>
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}
