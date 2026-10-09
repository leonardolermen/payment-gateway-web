import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useMatch, useNavigate } from "react-router";
import { useCan } from "../auth/useCan";
import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { PageHeader } from "../support/ui/PageHeader";
import { Table } from "../support/ui/Table";
import { listOrders, orderKeys, PAGE_SIZE } from "./orderApi";
import { payerLabel } from "./payerLabel";
import { StatusBadge } from "./StatusBadge";
import type { OrderStatus } from "./types";

// The mockup's four columns: description and method are one click away, in the detail.
const HEADERS = ["Criado", "Cliente", "Valor", "Status"];

const FILTERS: { label: string; value: OrderStatus | "" }[] = [
  { label: "Todas", value: "" },
  { label: "Abertas", value: "OPEN" },
  { label: "Pagas", value: "PAID" },
  { label: "Canceladas", value: "CANCELED" },
  { label: "Expiradas", value: "EXPIRED" },
];

type Props = { onNewOrder: () => void };

export function OrdersList({ onNewOrder }: Props) {
  const selectedId = useMatch("/app/orders/:id")?.params.id;
  const navigate = useNavigate();
  const mayCreateCharge = useCan("create_charge");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const filter = status || undefined;

  const query = useInfiniteQuery({
    queryKey: orderKeys.list({ status: filter }),
    queryFn: ({ pageParam }) => listOrders({ status: filter, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length < PAGE_SIZE ? undefined : last.at(-1)?.id),
    // Polling a hidden tab only burns the rate limit.
    refetchInterval: () => (document.visibilityState === "visible" ? 10_000 : false),
    refetchIntervalInBackground: false,
  });

  const orders = query.data?.pages.flat() ?? [];

  return (
    <section className="space-y-3">
      <PageHeader
        title="Cobranças"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Not in the mockup, kept: the filter rides the title row as a quiet ghost pill. */}
            <label className="flex items-center gap-2 rounded-pill border border-line bg-surface py-1 pr-1 pl-3 text-xs text-muted">
              Status{" "}
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as OrderStatus | "")}
                className="rounded-pill bg-transparent py-1 pr-1 font-semibold text-ink outline-none"
              >
                {FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {mayCreateCharge && (
              <Button onClick={onNewOrder}>
                <span aria-hidden="true">+</span>Nova cobrança
              </Button>
            )}
          </div>
        }
      />

      {query.isError && (
        <p role="alert" className="text-danger">
          Não foi possível carregar as cobranças.
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <Table headers={HEADERS}>
          {orders.map((order) => (
            // The whole row opens the detail for the mouse; the date stays the link for the keyboard.
            <tr
              key={order.id}
              data-selected={order.id === selectedId}
              onClick={() => navigate(`/app/orders/${order.id}`)}
              className="cursor-pointer hover:bg-surface-muted data-[selected=true]:bg-surface-muted data-[selected=true]:shadow-[inset_3px_0_0_var(--color-accent)]"
            >
              <td className="whitespace-nowrap">
                <Link
                  to={`/app/orders/${order.id}`}
                  aria-current={order.id === selectedId ? "true" : undefined}
                  className="font-medium text-accent underline-offset-2 hover:underline"
                >
                  {formatDateTime(order.created_at)}
                </Link>
              </td>
              <td>{payerLabel(order)}</td>
              <td className="font-display font-bold whitespace-nowrap">
                {formatBrl(order.amount)}
              </td>
              <td>
                <StatusBadge status={order.status} />
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {query.isSuccess && orders.length === 0 && (
        <p className="text-center text-muted">Nenhuma cobrança por aqui.</p>
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
