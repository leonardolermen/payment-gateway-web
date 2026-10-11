import { useState } from "react";
import { Button } from "../support/ui/Button";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
  showStrength?: boolean;
};

type Strength = { label: string; classes: string };

// Length is the only rule the gateway enforces (10 minimum), so it is the only thing graded.
function strengthOf(password: string): Strength {
  if (password.length < 10) {
    return { label: "curta demais", classes: "w-1/3 bg-danger" };
  }

  if (password.length < 14) {
    return { label: "razoável", classes: "w-2/3 bg-warn-fg" };
  }

  return { label: "forte", classes: "w-full bg-ok-fg" };
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  showStrength,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const strength = strengthOf(value);

  return (
    <Field label={label} htmlFor={id} error={error} errorId={`${id}-error`}>
      <div className="flex gap-2">
        <input
          id={id}
          type={revealed ? "text" : "password"}
          autoComplete={autoComplete}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={INPUT_CLASSES}
        />
        <Button variant="ghost" onClick={() => setRevealed((shown) => !shown)}>
          {revealed ? "Ocultar" : "Mostrar"}
        </Button>
      </div>

      {showStrength && value !== "" && (
        <div className="space-y-1">
          <div className="h-1 rounded-full bg-line">
            <div className={`h-1 rounded-full ${strength.classes}`} />
          </div>
          <p className="text-xs text-muted">{strength.label}</p>
        </div>
      )}
    </Field>
  );
}
