import type { ChangeEvent } from "react";
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

export function PemField({ id, label, value, onChange, secret, error }: Props) {
  function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <Field label={label} htmlFor={id} error={error} errorId={`${id}-error`}>
      <textarea
        id={id}
        rows={6}
        value={value}
        disabled={secret?.removed}
        placeholder={secretPlaceholder(secret)}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
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
