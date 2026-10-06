import type { ComponentProps } from "react";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";

type Props = ComponentProps<"input"> & { label: string; error?: string };

export function TextField({ label, error, id, ...input }: Props) {
  const inputId = id ?? `field-${label}`;

  return (
    <Field label={label} htmlFor={inputId} error={error} errorId={`${inputId}-error`}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={INPUT_CLASSES}
        {...input}
      />
    </Field>
  );
}
