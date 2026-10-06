import type { ReactNode } from "react";

type Props = {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  errorId?: string;
  children: ReactNode;
};

// Owns only the label/hint/error frame: the input stays the caller's, so ids, aria-invalid and
// controlled state remain exactly where the tests and the card rules expect them.
export function Field({ label, htmlFor, hint, error, errorId, children }: Props) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
