import { useState, type ChangeEvent } from "react";
import { Field } from "../../support/ui/Field";
import { RemoveOrKeep } from "./SecretControls";
import { secretPlaceholder, type StoredSecret } from "./storedSecret";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret?: StoredSecret;
  error?: string;
};

// A real certificate or key is a few KB; anything bigger is the wrong file (a .p12, a zip), and
// reading it into the textarea would only freeze the page before the gateway rejected it anyway.
const MAX_FILE_BYTES = 64 * 1024;

export function PemField({ id, label, value, onChange, secret, error }: Props) {
  const [fileError, setFileError] = useState<string>();

  function adopt(content: string) {
    if (!content.includes("-----BEGIN")) {
      setFileError("Arquivo não parece um PEM");
      return;
    }

    setFileError(undefined);
    onChange(content);
  }

  function readFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    // Cleared so that picking the same file again (after a rejection, say) fires change again.
    input.value = "";
    if (!file) {
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setFileError("Arquivo muito grande (máx. 64 KB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => adopt(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  const shownError = error ?? fileError;

  return (
    <Field label={label} htmlFor={id} error={shownError} errorId={`${id}-error`}>
      <textarea
        id={id}
        rows={6}
        value={value}
        disabled={secret?.removed}
        placeholder={secretPlaceholder(secret)}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={shownError ? `${id}-error` : undefined}
        className="w-full rounded-lg border border-line bg-field p-3 font-mono text-xs text-ink outline-none focus:border-accent aria-[invalid=true]:border-danger"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".pem,.crt,.key,.cer"
          aria-label={`Arquivo para ${label}`}
          disabled={secret?.removed}
          onChange={readFile}
          className="text-xs text-muted"
        />
        {secret && <RemoveOrKeep label={label} secret={secret} />}
      </div>
    </Field>
  );
}
