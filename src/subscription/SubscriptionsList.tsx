import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useMatch, useNavigate } from "react-router";
import { METHOD_LABELS } from "../order/methodLabels";
import { formatDateTime } from "../support/dates";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { PageHeader } from "../support/ui/PageHeader";
import { Table } from "../support/ui/Table";
import { PlanName } from "./PlanName";
import { listSubscriptions, SUBSCRIPTION_PAGE_SIZE, subscriptionKeys } from "./subscriptionApi";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import type { SubscriptionStatus } from "./types";

const HEADERS = ["Cliente", "Plano", "Método", "Status", "Próxima cobrança"];

// INCOMPLETE_EXPIRED has no option of its own: the gateway may answer it under "Encerradas", and
// the list shows whatever comes back.
const FILTERS: { label: string; value: SubscriptionStatus | "" }[] = [
  { label: "Todas", value: "" },
  { label: "Ativas", value: "ACTIVE" },
  { label: "Em atraso", value: "PAST_DUE" },
  { label: "Incompletas", value: "INCOMPLETE" },
  { label: "Canceladas", value: "CANCELED" },
  { label: "Encerradas", value: "ENDED" },
];

export function SubscriptionsList() {
  const selectedId = useMatch("/app/subscriptions/:id")?.params.id;
  const navigate = useNavigate();
  const [status, setStatus] = useState<SubscriptionStatus | "">("");
  const filter = status || undefined;

  const query = useInfiniteQuery({
    queryKey: subscriptionKeys.page({ status: filter }),
    queryFn: ({ pageParam }) =>
      listSubscriptions({ status: filter, cursor: pageParam, limit: SUBSCRIPTION_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length < SUBSCRIPTION_PAGE_SIZE ? undefined : last.at(-1)?.id,
    // Polling a hidden tab only burns the rate limit.
    refetchInterval: () => (document.visibilityState === "visible" ? 10_000 : false),
    refetchIntervalInBackground: false,
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
                <option key={option.value} value={option.value}>
                  {option.label}
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
          {subscriptions.map((subscription) => {
            const isSelected = subscription.id === selectedId;

            return (
              // The whole row opens the detail for the mouse; the customer stays the link for the
              // keyboard.
              <tr
                key={subscription.id}
                data-selected={isSelected}
                onClick={() => navigate(`/app/subscriptions/${subscription.id}`)}
                className="cursor-pointer hover:bg-surface-muted data-[selected=true]:bg-surface-muted data-[selected=true]:shadow-[inset_3px_0_0_var(--color-accent)]"
              >
                <td>
                  <Link
                    to={`/app/subscriptions/${subscription.id}`}
                    aria-current={isSelected ? "true" : undefined}
                    className="font-medium text-accent underline-offset-2 hover:underline"
                  >
                    {/* A deleted customer leaves only the id behind. */}
                    {subscription.customer_name ?? subscription.customer_id}
                  </Link>
                </td>
                <td>
                  <PlanName planId={subscription.plan_id} />
                </td>
                <td>{METHOD_LABELS[subscription.method]}</td>
                <td>
                  <SubscriptionStatusBadge status={subscription.status} />
                </td>
                <td className="whitespace-nowrap">
                  {subscription.next_billing_at
                    ? formatDateTime(subscription.next_billing_at)
                    : "—"}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {query.isSuccess && subscriptions.length === 0 && (
        <p className="text-center text-muted">Nenhuma assinatura por aqui.</p>
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
