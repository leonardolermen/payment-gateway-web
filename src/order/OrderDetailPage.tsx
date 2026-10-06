import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";
import { AttemptsTable } from "./AttemptsTable";
import { getOrder, listAttempts, orderKeys } from "./orderApi";
import { StatusBadge } from "./StatusBadge";

const IN_FLIGHT = new Set(["PENDING", "AUTHORIZED", "CREATED"]);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function OrderDetailPage() {
  const { id = "" } = useParams();

  const order = useQuery({ queryKey: orderKeys.detail(id), queryFn: () => getOrder(id) });

  const attempts = useQuery({
    queryKey: orderKeys.attempts(id),
    queryFn: () => listAttempts(id),
    // Poll only while the payer may still be paying; a settled order stops costing requests.
    refetchInterval: (query) => {
      const inFlight = (query.state.data ?? []).some((attempt) => IN_FLIGHT.has(attempt.status));
      return inFlight && document.visibilityState === "visible" ? 5_000 : false;
    },
    refetchIntervalInBackground: false,
  });

  if (order.isError) {
    return <p role="alert">Não foi possível carregar a cobrança.</p>;
  }
  if (!order.data) {
    return <p>Carregando…</p>;
  }

  const data = order.data;

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Cobrança {data.id}</h1>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Valor">{formatBrl(data.amount)}</Field>
        <Field label="Status">
          <StatusBadge status={data.status} />
        </Field>
        <Field label="Descrição">{data.description ?? "—"}</Field>
        <Field label="Referência">{data.reference ?? "—"}</Field>
        <Field label="Criado em">{formatDateTime(data.created_at)}</Field>
        <Field label="Vence em">{data.expires_at ? formatDateTime(data.expires_at) : "—"}</Field>
      </dl>

      {/* CheckoutLinkPanel: Task 5 */}
      {/* OrderActions: Task 5 */}

      <div>
        <h2 className="mb-2 font-medium">Tentativas de pagamento</h2>
        <AttemptsTable attempts={attempts.data ?? []} />
      </div>
    </section>
  );
}
