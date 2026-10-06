import { useState } from "react";
import { copyToClipboard } from "../support/copyToClipboard";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    setCopied(await copyToClipboard(text));
  }

  return (
    <button type="button" className="rounded border px-3 py-1" onClick={() => void copy()}>
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}
