import { Link } from "react-router";
import { METHOD_LABELS } from "../order/methodLabels";
import { Entry } from "../order/OrderSummary";
import { formatDate, formatDateTime } from "../support/dates";
import { Badge } from "../support/ui/Badge";
import { PlanName } from "./PlanName";
import { SavedCardName } from "./SavedCardName";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import type { Subscription } from "./types";

function periodLabel(period: Subscription["current_period"]): string {
  if (period === null) {
    return "—";
  }

  return `${formatDate(period.start)} – ${formatDate(period.end)}`;
}

export function SubscriptionHeader({ subscription }: { subscription: Subscription }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-[22px] font-bold">
          <PlanName planId={subscription.plan_id} />
        </h2>
        <SubscriptionStatusBadge status={subscription.status} />
        {subscription.cancel_at_period_end && <Badge tone="warn">Cancela no fim do período</Badge>}
      </div>

      <dl className="text-sm">
        <Entry label="Cliente">
          <Link to={`/app/customers/${subscription.customer_id}`} className="hover:underline">
            {subscription.customer_name ?? subscription.customer_id}
          </Link>
        </Entry>
        <Entry label="Método">
          <span>{METHOD_LABELS[subscription.method]}</span>
          {subscription.card_id && (
            <>
              <span aria-hidden="true" className="text-muted">
                {" · "}
              </span>
              <SavedCardName cardId={subscription.card_id} />
            </>
          )}
        </Entry>
        <Entry label="Período atual">{periodLabel(subscription.current_period)}</Entry>
        <Entry label="Próxima cobrança">
          {subscription.next_billing_at ? formatDateTime(subscription.next_billing_at) : "—"}
        </Entry>
      </dl>
    </div>
  );
}
