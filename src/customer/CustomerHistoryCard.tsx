import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { METHOD_LABELS } from "../order/methodLabels";
import { listOrders, orderKeys } from "../order/orderApi";
import { StatusBadge } from "../order/StatusBadge";
import { listSubscriptions, subscriptionKeys } from "../subscription/subscriptionApi";
import { SUBSCRIPTION_STATUS } from "../subscription/subscriptionLabels";
import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";
import { Badge } from "../support/ui/Badge";
import { Card } from "../support/ui/Card";
import { Table } from "../support/ui/Table";

// The newest orders, newest first: the history is a glance, the orders list is where to dig.
const HISTORY_SIZE = 10;

type Props = { customerId: string };

type BlockProps = {
  id: string;
  title: string;
  failure: string | null;
  emptyText: string | null;
  children: ReactNode;
};

function HistoryBlock({ id, title, failure, emptyText, children }: BlockProps) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-[10px] font-medium tracking-wider text-muted uppercase">
        {title}
      </h3>

      {failure && (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      )}

      {emptyText ? <p className="text-sm text-muted">{emptyText}</p> : children}
    </section>
  );
}

function OrdersHistory({ customerId }: Props) {
  const params = { customer_id: customerId, limit: HISTORY_SIZE };
  const orders = useQuery({ queryKey: orderKeys.list(params), queryFn: () => listOrders(params) });

  return (
    <HistoryBlock
      id="customer-orders-title"
      title="Cobranças"
      failure={orders.isError ? "Não foi possível carregar as cobranças." : null}
      emptyText={orders.data?.length === 0 ? "Nenhuma cobrança deste cliente." : null}
    >
      {orders.data && (
        <Table headers={["Criada", "Valor", "Status"]}>
          {orders.data.map((order) => (
            <tr key={order.id}>
              <td className="whitespace-nowrap">
                <Link to={`/app/orders/${order.id}`} className="hover:underline">
                  {formatDateTime(order.created_at)}
                </Link>
              </td>
              <td className="tabular-nums">{formatBrl(order.amount)}</td>
              <td>
                <StatusBadge status={order.status} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </HistoryBlock>
  );
}

// All of the customer's subscriptions: with customer_id the gateway sends them unpaged and
// ignores the limit.
function SubscriptionsHistory({ customerId }: Props) {
  const params = { customer_id: customerId };
  const subscriptions = useQuery({
    queryKey: subscriptionKeys.list(params),
    queryFn: () => listSubscriptions(params),
  });

  return (
    <HistoryBlock
      id="customer-subscriptions-title"
      title="Assinaturas"
      failure={subscriptions.isError ? "Não foi possível carregar as assinaturas." : null}
      emptyText={subscriptions.data?.length === 0 ? "Nenhuma assinatura deste cliente." : null}
    >
      {subscriptions.data && (
        <Table headers={["Criada", "Método", "Status", "Próxima cobrança"]}>
          {subscriptions.data.map((subscription) => (
            <tr key={subscription.id}>
              <td className="whitespace-nowrap">
                <Link to={`/app/subscriptions/${subscription.id}`} className="hover:underline">
                  {formatDateTime(subscription.created_at)}
                </Link>
              </td>
              <td>{METHOD_LABELS[subscription.method]}</td>
              <td>
                <Badge tone={SUBSCRIPTION_STATUS[subscription.status].tone}>
                  {SUBSCRIPTION_STATUS[subscription.status].label}
                </Badge>
              </td>
              <td className="whitespace-nowrap text-muted">
                {subscription.next_billing_at ? formatDateTime(subscription.next_billing_at) : "—"}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </HistoryBlock>
  );
}

export function CustomerHistoryCard({ customerId }: Props) {
  return (
    <Card>
      <div className="space-y-4">
        <h2 className="font-display text-base font-semibold">Histórico</h2>
        <OrdersHistory customerId={customerId} />
        <SubscriptionsHistory customerId={customerId} />
      </div>
    </Card>
  );
}
