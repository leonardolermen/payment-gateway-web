type Props = { onLeave: () => void; isLeaving: boolean; error: string | null };

// The cancel itself lives in PayPage (useLeaveAttempt): the browser's back button takes the same
// path, so a Pix is never left payable behind the payer's back.
export function SwitchMethodButton({ onLeave, isLeaving, error }: Props) {
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={isLeaving}
        className="text-sm text-muted underline underline-offset-2 hover:text-ink"
        onClick={onLeave}
      >
        {isLeaving ? "Cancelando…" : "Escolher outra forma de pagamento"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
