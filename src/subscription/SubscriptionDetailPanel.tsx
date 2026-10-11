import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Card } from "../support/ui/Card";
import { DunningTable } from "./DunningTable";
import { InvoicesTable } from "./InvoicesTable";
import { SubscriptionActions } from "./SubscriptionActions";
import { getSubscription, listSubscriptionOrders, subscriptionKeys } from "./subscriptionApi";
import { SubscriptionHeader } from "./SubscriptionHeader";
import type { SubscriptionStatus } from "./types";

// The payer owes an invoice: a payment may land any moment, so the panel looks twice as often.
const OWES = new Set<SubscriptionStatus>(["INCOMPLETE", "PAST_DUE"]);

// Polling a hidden tab only burns the rate limit.
function pollInterval(status: SubscriptionStatus | undefined): number | false {
  if (document.visibilityState !== "visible") {
    return false;
  }

  return status !== undefined && OWES.has(status) ? 5_000 : 10_000;
}

// Keyed by id: moving from one subscription to the next must not carry the previous one's open
// dialog or rotated link along.
export function SubscriptionDetailPanel() {
  const { id = "" } = useParams();
  return <SubscriptionDetail key={id} id={id} />;
}

function SubscriptionDetail({ id }: { id: string }) {
  const subscription = useQuery({
    queryKey: subscriptionKeys.detail(id),
    queryFn: () => getSubscription(id),
    refetchInterval: (query) => pollInterval(query.state.data?.status),
    refetchIntervalInBackground: false,
  });

  // Same cadence as the subscription: a paid invoice and the status it brings back go together.
  const status = subscription.data?.status;
  const invoices = useQuery({
    queryKey: subscriptionKeys.orders(id),
    queryFn: () => listSubscriptionOrders(id),
    refetchInterval: () => pollInterval(status),
    refetchIntervalInBackground: false,
  });

  // Only when there is nothing to show: a failed poll must not unmount an open dialog.
  if (subscription.isError && !subscription.data) {
    return (
      <p role="alert" className="text-danger">
        Não foi possível carregar a assinatura.
      </p>
    );
  }

  if (!subscription.data) {
    return <p className="text-muted">Carregando…</p>;
  }

  const current = subscription.data;

  return (
    <section aria-label={`Assinatura ${current.id}`} className="space-y-4">
      {subscription.isError && (
        <p role="status" className="text-sm text-warn-fg">
          Não foi possível atualizar. Mostrando os últimos dados.
        </p>
      )}

      <Card className="min-w-0 space-y-5">
        <SubscriptionHeader subscription={current} />
        <SubscriptionActions subscription={current} />
      </Card>

      <Card className="min-w-0">
        <InvoicesTable subscription={current} invoices={invoices.data} failed={invoices.isError} />
      </Card>

      {current.dunning.length > 0 && (
        <Card className="min-w-0">
          <DunningTable dunning={current.dunning} />
        </Card>
      )}
    </section>
  );
}
