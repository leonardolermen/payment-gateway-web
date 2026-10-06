import type { ReactNode } from "react";
import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";
import { Card } from "../support/ui/Card";
import { StatusBadge } from "./StatusBadge";
import type { Order } from "./types";

function Entry({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

export function OrderSummary({ order }: { order: Order }) {
  return (
    <Card>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Entry label="Valor">
          <span className="font-display text-2xl">{formatBrl(order.amount)}</span>
        </Entry>
        <Entry label="Status">
          <StatusBadge status={order.status} />
        </Entry>
        <Entry label="Descrição">{order.description ?? "—"}</Entry>
        <Entry label="Referência">{order.reference ?? "—"}</Entry>
        <Entry label="Criado em">{formatDateTime(order.created_at)}</Entry>
        <Entry label="Vence em">{order.expires_at ? formatDateTime(order.expires_at) : "—"}</Entry>
      </dl>
    </Card>
  );
}
