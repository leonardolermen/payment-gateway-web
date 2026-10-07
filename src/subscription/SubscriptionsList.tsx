import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useMatch, useNavigate } from "react-router";
import { formatDay } from "../support/dates";
import { formatBrl } from "../support/money";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { PageHeader } from "../support/ui/PageHeader";
import { Table } from "../support/ui/Table";
import { cadence, STATUS_LABELS } from "./labels";
import { listSubscriptions, SUBSCRIPTION_PAGE_SIZE, subscriptionKeys } from "./subscriptionApi";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import type { SubscriptionStatus } from "./types";

const HEADERS = ["Cliente", "Plano", "Próxima cobrança", "Status"];

const FILTERS: (SubscriptionStatus | "")[] = ["", "ACTIVE", "PAST_DUE", "INCOMPLETE", "CANCELED"];

export function SubscriptionsList() {
  const [status, setStatus] = useState<SubscriptionStatus | "">("");
  const filter = status || undefined;
  const selectedId = useMatch("/app/subscriptions/:id")?.params.id;
  const navigate = useNavigate();

  const query = useInfiniteQuery({
    queryKey: subscriptionKeys.list(filter),
    queryFn: ({ pageParam }) =>
      listSubscriptions({ status: filter, cursor: pageParam, limit: SUBSCRIPTION_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length < SUBSCRIPTION_PAGE_SIZE ? undefined : last.at(-1)?.id,
  });
  const subscriptions = query.data?.pages.flat() ?? [];

  return (
    <section className="space-y-3">
      <PageHeader
        title="Assinaturas"
        action={
          <label className="flex items-center gap-2 rounded-pill border border-line bg-surface py-1 pr-1 pl-3 text-xs text-muted">
            Status{" "}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as SubscriptionStatus | "")}
              className="rounded-pill bg-transparent py-1 pr-1 font-semibold text-ink outline-none"
            >
              {FILTERS.map((option) => (
                <option key={option} value={option}>
                  {option === "" ? "Todas" : STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {query.isError && (
        <p role="alert" className="text-danger">
          Não foi possível carregar as assinaturas.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <Table headers={HEADERS}>
          {subscriptions.map((subscription) => (
            <tr
              key={subscription.id}
              data-selected={subscription.id === selectedId}
              onClick={() => navigate(`/app/subscriptions/${subscription.id}`)}
              className="cursor-pointer hover:bg-surface-muted data-[selected=true]:bg-surface-muted data-[selected=true]:shadow-[inset_3px_0_0_var(--color-accent)]"
            >
              <td>
                <Link
                  to={`/app/subscriptions/${subscription.id}`}
                  aria-current={subscription.id === selectedId ? "true" : undefined}
                  className="font-medium text-accent underline-offset-2 hover:underline"
                >
                  {subscription.customer_name ?? `${subscription.customer_id.slice(0, 8)}…`}
                </Link>
              </td>
              <td>
                <span className="block">{subscription.plan_name ?? "—"}</span>
                {subscription.amount !== null && subscription.interval && (
                  <span className="text-xs text-muted">
                    {formatBrl(subscription.amount)} ·{" "}
                    {cadence(subscription.interval, subscription.interval_count ?? 1)}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap">
                {subscription.next_billing_at ? formatDay(subscription.next_billing_at) : "—"}
              </td>
              <td>
                <SubscriptionStatusBadge status={subscription.status} />
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {query.isSuccess && subscriptions.length === 0 && (
        <p className="text-center text-muted">
          Nenhuma assinatura. Crie uma em Cobranças, escolhendo "Recorrente".
        </p>
      )}

      {query.hasNextPage && (
        <Button
          variant="ghost"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          Carregar mais
        </Button>
      )}
    </section>
  );
}
