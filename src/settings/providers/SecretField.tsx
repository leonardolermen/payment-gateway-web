import { useState } from "react";
import { Button } from "../../support/ui/Button";
import { Field } from "../../support/ui/Field";
import { INPUT_CLASSES } from "../../support/ui/inputClasses";
import { RemoveOrKeep } from "./SecretControls";
import { secretPlaceholder, type StoredSecret } from "./storedSecret";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret: StoredSecret;
  error?: string;
};

export function SecretField({ id, label, value, onChange, secret, error }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} htmlFor={id} error={error} errorId={`${id}-error`}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="off"
          value={value}
          disabled={secret.removed}
          placeholder={secretPlaceholder(secret)}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={INPUT_CLASSES}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label={visible ? `Ocultar ${label}` : `Mostrar ${label}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </Button>
        <RemoveOrKeep label={label} secret={secret} />
      </div>
    </Field>
  );
}
