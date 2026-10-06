import type { ReactNode } from "react";

type Props = {
  title: string;
  confirmLabel: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

// A plain labelled dialog, not <dialog>.showModal(): jsdom lacks it, and the panel needs no
// more than an overlay for a two-button question.
export function ConfirmDialog({
  title,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onCancel,
  children,
}: Props) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm space-y-4 rounded bg-white p-4"
      >
        <h2 className="font-medium">{title}</h2>
        {children}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border px-3 py-1">
            Voltar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded bg-red-700 px-3 py-1 text-white disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
