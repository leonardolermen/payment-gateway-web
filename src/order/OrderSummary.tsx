import type { ReactNode } from "react";
import { Link } from "react-router";
import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";
import { payerLabel } from "./payerLabel";
import { StatusBadge } from "./StatusBadge";
import type { Order } from "./types";

function Entry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-line py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words">{children}</dd>
    </div>
  );
}

// Rendered inside the page's card: the summary, the link and the actions read as one block.
export function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-[22px] font-bold">{formatBrl(order.amount)}</span>
        <StatusBadge status={order.status} />
      </div>
      <dl className="text-sm">
        <Entry label="Cliente">{payerLabel(order)}</Entry>
        <Entry label="Descrição">{order.description ?? "—"}</Entry>
        {order.reference && <Entry label="Referência">{order.reference}</Entry>}
        {order.subscription_id && (
          <Entry label="Assinatura">
            <Link
              to={`/app/subscriptions/${order.subscription_id}`}
              className="text-accent underline-offset-2 hover:underline"
            >
              Fatura {order.invoice_number ?? "—"}
            </Link>
          </Entry>
        )}
        <Entry label="Vence">{order.expires_at ? formatDateTime(order.expires_at) : "—"}</Entry>
      </dl>
    </div>
  );
}
