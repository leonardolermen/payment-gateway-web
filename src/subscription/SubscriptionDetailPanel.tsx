import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { StatusBadge } from "../order/StatusBadge";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { formatDate, formatDay } from "../support/dates";
import { messageFor } from "../support/gatewayError";
import { formatBrl } from "../support/money";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { cadence, METHOD_NAMES } from "./labels";
import {
  cancelSubscription,
  getSubscription,
  listInvoices,
  subscriptionKeys,
} from "./subscriptionApi";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";

const CANCELABLE = new Set(["INCOMPLETE", "ACTIVE", "PAST_DUE"]);

export function SubscriptionDetailPanel() {
  const { id = "" } = useParams();
  return <SubscriptionDetail key={id} id={id} />;
}

function SubscriptionDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const subscription = useQuery({
    queryKey: subscriptionKeys.detail(id),
    queryFn: () => getSubscription(id),
  });
  const invoices = useQuery({
    queryKey: subscriptionKeys.invoices(id),
    queryFn: () => listInvoices(id),
  });
  const [confirming, setConfirming] = useState<"period_end" | "now" | null>(null);
  const cancelKey = useIdempotencyKey();
  const cancel = useMutation({
    mutationFn: (atPeriodEnd: boolean) => cancelSubscription(id, atPeriodEnd, cancelKey.current()),
    onSuccess: async () => {
      cancelKey.renew();
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });

  if (subscription.isError) {
    return (
      <p role="alert" className="text-danger">
        Não foi possível carregar a assinatura.
      </p>
    );
  }
  if (!subscription.data) {
    return <p className="text-muted">Carregando…</p>;
  }

  const data = subscription.data;
  // The invoice a past-due or new subscription is waiting on: the one still open.
  const openInvoice = (invoices.data ?? []).find((invoice) => invoice.status === "OPEN");

  return (
    <section aria-label={`Assinatura ${data.id}`} className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[22px] font-bold">
            {data.amount !== null ? formatBrl(data.amount) : "—"}
          </span>
          {data.interval && (
            <span className="text-sm text-muted">
              {cadence(data.interval, data.interval_count ?? 1)}
            </span>
          )}
          <SubscriptionStatusBadge status={data.status} />
        </div>

        <dl className="text-sm">
          <Entry label="Cliente">{data.customer_name ?? data.customer_id}</Entry>
          <Entry label="Plano">{data.plan_name ?? data.plan_id}</Entry>
          <Entry label="Forma de pagamento">{METHOD_NAMES[data.method]}</Entry>
          <Entry label="Período atual">
            {data.current_period
              ? `${formatDate(data.current_period.start)} – ${formatDate(data.current_period.end)}`
              : "—"}
          </Entry>
          <Entry label="Próxima cobrança">
            {data.cancel_at_period_end
              ? "Encerra no fim do período"
              : data.next_billing_at
                ? formatDay(data.next_billing_at)
                : "—"}
          </Entry>
        </dl>

        {openInvoice && (data.status === "PAST_DUE" || data.status === "INCOMPLETE") && (
          <div role="status" className="rounded-xl bg-warn-bg p-3 text-sm text-warn-fg">
            <p className="font-semibold">
              {data.status === "PAST_DUE"
                ? "Pagamento em atraso"
                : "Aguardando o cliente pagar a 1ª cobrança"}
            </p>
            <p className="mt-1">
              Fatura {openInvoice.invoice_number} de {formatBrl(openInvoice.amount)}.{" "}
              <Link
                to={`/app/orders/${openInvoice.id}`}
                className="font-semibold underline underline-offset-2"
              >
                Abrir a cobrança
              </Link>{" "}
              para gerar um novo link ou cobrar de novo.
            </p>
          </div>
        )}

        {CANCELABLE.has(data.status) && !data.cancel_at_period_end && (
          <div className="flex flex-wrap gap-2">
            {data.status !== "INCOMPLETE" && (
              <Button variant="ghost" size="sm" onClick={() => setConfirming("period_end")}>
                Cancelar no fim do período
              </Button>
            )}
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirming("now")}>
              Cancelar agora
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-sm font-semibold">Faturas</h2>
        {(invoices.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nenhuma fatura ainda.</p>
        ) : (
          <ul className="text-sm">
            {(invoices.data ?? []).map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-dashed border-line py-2 last:border-b-0"
              >
                <Link
                  to={`/app/orders/${invoice.id}`}
                  className="font-semibold text-accent underline-offset-2 hover:underline"
                >
                  Fatura {invoice.invoice_number}
                </Link>
                {invoice.period && (
                  <span className="text-muted">
                    {formatDate(invoice.period.start)} – {formatDate(invoice.period.end)}
                  </span>
                )}
                <span className="ml-auto font-display font-bold">{formatBrl(invoice.amount)}</span>
                <StatusBadge status={invoice.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {confirming && (
        <ConfirmDialog
          title={
            confirming === "now" ? "Cancelar a assinatura agora?" : "Cancelar no fim do período?"
          }
          confirmLabel="Confirmar"
          pending={cancel.isPending}
          error={cancel.isError ? messageFor(cancel.error) : null}
          onConfirm={() => cancel.mutate(confirming === "period_end")}
          onCancel={() => {
            setConfirming(null);
            cancelKey.renew();
            cancel.reset();
          }}
        >
          <p className="text-sm text-muted">
            {confirming === "now"
              ? "A cobrança em aberto é cancelada e nenhuma outra é gerada. Nada é estornado."
              : "O período já pago continua valendo; nenhuma cobrança nova é gerada depois dele."}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function Entry({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-line py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words">{children}</dd>
    </div>
  );
}
