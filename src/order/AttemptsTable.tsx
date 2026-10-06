import { formatBrl } from "../support/money";
import { formatDateTime } from "../support/dates";
import { StatusBadge } from "./StatusBadge";
import { METHOD_LABELS } from "./methodLabels";
import type { Payment } from "./types";

// A list of "method · when" rows like the mockup: the panel never shows more than a handful of
// attempts per order, and a five-column table was the widest thing on the page.
export function AttemptsTable({ attempts }: { attempts: Payment[] }) {
  if (attempts.length === 0) {
    return <p className="text-sm text-muted">Nenhuma tentativa de pagamento ainda.</p>;
  }

  return (
    <ul className="text-sm">
      {attempts.map((attempt) => (
        <li
          key={attempt.id}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-dashed border-line py-2 last:border-b-0"
        >
          <span className="font-semibold">{METHOD_LABELS[attempt.method]}</span>
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <span className="text-muted">{formatDateTime(attempt.created_at)}</span>
          <span className="ml-auto font-display font-bold">{formatBrl(attempt.amount)}</span>
          <StatusBadge status={attempt.status} kind="payment" />
          <span className="basis-full font-mono text-[10px] text-muted">{attempt.id}</span>
        </li>
      ))}
    </ul>
  );
}
