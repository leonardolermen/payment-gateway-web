import type { ReactNode } from "react";
import { Button } from "./ui/Button";

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
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm space-y-4 rounded-card border border-line bg-surface p-5 text-ink shadow-xl"
      >
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {children}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Voltar
          </Button>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
