import type { ComponentProps } from "react";

type Props = ComponentProps<"input"> & { label: string; error?: string };

export function TextField({ label, error, id, ...input }: Props) {
  const inputId = id ?? `field-${label}`;

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className="w-full rounded border px-2 py-1"
        {...input}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
