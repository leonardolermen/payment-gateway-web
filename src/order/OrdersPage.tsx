import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";
import { METHOD_LABELS } from "./methodLabels";
import { listOrders, orderKeys, PAGE_SIZE } from "./orderApi";
import { StatusBadge } from "./StatusBadge";
import type { Order, OrderStatus } from "./types";

const FILTERS: { label: string; value: OrderStatus | "" }[] = [
  { label: "Todas", value: "" },
  { label: "Abertas", value: "OPEN" },
  { label: "Pagas", value: "PAID" },
  { label: "Canceladas", value: "CANCELED" },
  { label: "Expiradas", value: "EXPIRED" },
];

// No payer name on the order yet: the customer id is shortened until a later task enriches it.
function payerLabel(order: Order): string {
  return order.customer_id ? `${order.customer_id.slice(0, 8)}…` : "pagador avulso";
}

// The method of the attempt that settled the order, else the latest attempt, else nothing.
function methodLabel(order: Order): string {
  const paid = order.payments.find((attempt) => attempt.id === order.paid_payment_id);
  const attempt = paid ?? order.payments.at(-1);
  return attempt ? METHOD_LABELS[attempt.method] : "—";
}

export function OrdersPage() {
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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cobranças</h1>
        <Link to="/app/orders/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          Nova cobrança
        </Link>
      </div>

      <label className="block text-sm">
        Status{" "}
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as OrderStatus | "")}
          className="rounded border px-2 py-1"
        >
          {FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {query.isError && <p role="alert">Não foi possível carregar as cobranças.</p>}

      <table className="w-full text-left text-sm">
        <thead className="text-gray-500">
          <tr>
            <th className="py-2">Criado em</th>
            <th>Cliente/Pagador</th>
            <th>Descrição</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Método</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t">
              <td className="py-2">
                <Link to={`/app/orders/${order.id}`} className="underline">
                  {formatDateTime(order.created_at)}
                </Link>
              </td>
              <td>{payerLabel(order)}</td>
              <td>{order.description ?? "—"}</td>
              <td>{formatBrl(order.amount)}</td>
              <td>
                <StatusBadge status={order.status} />
              </td>
              <td>{methodLabel(order)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {query.isSuccess && orders.length === 0 && <p>Nenhuma cobrança por aqui.</p>}

      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="rounded border px-3 py-2 text-sm"
        >
          Carregar mais
        </button>
      )}
    </section>
  );
}
