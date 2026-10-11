import { Link } from "react-router";
import { useCan } from "../auth/useCan";
import { StatusBadge } from "../order/StatusBadge";
import type { Order } from "../order/types";
import { formatDate } from "../support/dates";
import { formatBrl } from "../support/money";
import { Table } from "../support/ui/Table";
import { ChargeAgainButton } from "./ChargeAgainButton";
import { InvoiceLinkButton } from "./InvoiceLinkButton";
import type { Subscription } from "./types";

const HEADERS = ["Nº", "Período", "Valor", "Status"];

type Props = { subscription: Subscription; invoices: Order[] | undefined; failed: boolean };

function invoiceNumber(invoice: Order): string {
  return invoice.invoice_number === null ? invoice.id : `#${invoice.invoice_number}`;
}

function periodLabel(invoice: Order): string {
  if (invoice.period === null) {
    return "—";
  }

  return `${formatDate(invoice.period.start)} – ${formatDate(invoice.period.end)}`;
}

function InvoiceActions({ invoice, subscription }: { invoice: Order; subscription: Subscription }) {
  const mayRotate = useCan("rotate_checkout_link");
  const mayCharge = useCan("create_charge");

  // Only an open invoice can still be paid; a card on file can be tried again without the payer.
  if (invoice.status !== "OPEN") {
    return null;
  }

  const savedCardId = subscription.method === "CARD" ? subscription.card_id : null;

  return (
    <div className="flex flex-wrap items-start gap-2">
      {mayRotate && <InvoiceLinkButton invoice={invoice} subscriptionId={subscription.id} />}
      {mayCharge && savedCardId !== null && (
        <ChargeAgainButton invoice={invoice} cardId={savedCardId} />
      )}
    </div>
  );
}

export function InvoicesTable({ subscription, invoices, failed }: Props) {
  const mayRotate = useCan("rotate_checkout_link");
  const mayCharge = useCan("create_charge");
  const hasActions = mayRotate || mayCharge;

  return (
    <section aria-labelledby="subscription-invoices-title" className="space-y-2">
      <h2 id="subscription-invoices-title" className="font-display text-sm font-semibold">
        Faturas
      </h2>

      {failed && (
        <p role="alert" className="text-sm text-danger">
          Não foi possível carregar as faturas.
        </p>
      )}

      {invoices?.length === 0 && <p className="text-sm text-muted">Nenhuma fatura ainda.</p>}

      {invoices && invoices.length > 0 && (
        <Table headers={hasActions ? [...HEADERS, "Ações"] : HEADERS}>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="font-mono text-xs whitespace-nowrap">
                <Link to={`/app/orders/${invoice.id}`} className="hover:underline">
                  {invoiceNumber(invoice)}
                </Link>
              </td>
              <td className="whitespace-nowrap">{periodLabel(invoice)}</td>
              <td className="tabular-nums">{formatBrl(invoice.amount)}</td>
              <td>
                <StatusBadge status={invoice.status} />
              </td>
              {hasActions && (
                <td>
                  <InvoiceActions invoice={invoice} subscription={subscription} />
                </td>
              )}
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
