import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";
import { AttemptsTable } from "./AttemptsTable";
import { CheckoutLinkPanel } from "./CheckoutLinkPanel";
import { getOrder, listAttempts, orderKeys } from "./orderApi";
import { OrderActions } from "./OrderActions";
import { StatusBadge } from "./StatusBadge";
import type { Payment } from "./types";

// Three more ticks after the last active attempt: the relay moves the order to PAID a moment
// after the attempt completes, and the refetch of that very tick can still see OPEN.
const GRACE_MS = 15_000;

const IN_FLIGHT = new Set(["PENDING", "AUTHORIZED", "CREATED"]);

function pollInterval(attempts: Payment[]): number | false {
  const inFlight = attempts.some((attempt) => IN_FLIGHT.has(attempt.status));
  return inFlight && document.visibilityState === "visible" ? 5_000 : false;
}

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

  const location = useLocation();
  const navigate = useNavigate();
  // Read once into state, then wiped from history: the link is shown only right after creation,
  // and a refresh must not resurrect it.
  const [initialUrl] = useState<string | null>(
    (location.state as { checkoutUrl?: string } | null)?.checkoutUrl ?? null,
  );
  useEffect(() => {
    if (initialUrl) {
      navigate(".", { replace: true, state: null });
    }
  }, [initialUrl, navigate]);

  const attempts = useQuery({
    queryKey: orderKeys.attempts(id),
    queryFn: () => listAttempts(id),
    refetchInterval: (query) => pollInterval(query.state.data ?? []),
    refetchIntervalInBackground: false,
  });

  const queryClient = useQueryClient();
  const wasInFlight = useRef(false);
  const settledAt = useRef<number | null>(null);
  const attemptsData = attempts.data;
  useEffect(() => {
    if (!attemptsData) {
      return;
    }
    const inFlight = attemptsData.some((attempt) => IN_FLIGHT.has(attempt.status));
    if (wasInFlight.current && !inFlight) {
      settledAt.current = Date.now();
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
    }
    wasInFlight.current = inFlight;
  }, [attemptsData, id, queryClient]);

  // Poll only while the payer may still be paying (or within the grace after settling); a
  // settled order stops costing requests.
  const pollEvery = pollInterval(attempts.data ?? []);

  // Same cadence as the attempts: a paid attempt must turn the summary PAID without a reload.
  const order = useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrder(id),
    refetchInterval: (query) => {
      const inGrace = settledAt.current !== null && Date.now() - settledAt.current < GRACE_MS;
      if (inGrace && query.state.data?.status === "OPEN") {
        return document.visibilityState === "visible" ? 5_000 : false;
      }
      return pollEvery;
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

      <CheckoutLinkPanel order={data} initialUrl={initialUrl} />
      <OrderActions order={data} attempts={attempts.data ?? []} />

      <div>
        <h2 className="mb-2 font-medium">Tentativas de pagamento</h2>
        <AttemptsTable attempts={attempts.data ?? []} />
      </div>
    </section>
  );
}
