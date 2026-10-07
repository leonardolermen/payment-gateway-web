import { useEffect, useState } from "react";
import { copyToClipboard } from "../support/copyToClipboard";
import { Button } from "../support/ui/Button";

const RESET_MS = 2_000;

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    setCopied(await copyToClipboard(text));
  }

  return (
    <>
      <Button size="lg" onClick={() => void copy()}>
        {copied ? "Copiado" : "Copiar"}
      </Button>
      {/* Announced once; the button label alone changes silently for a screen reader. */}
      <span role="status" className="sr-only">
        {copied ? "Código copiado" : ""}
      </span>
    </>
  );
}
