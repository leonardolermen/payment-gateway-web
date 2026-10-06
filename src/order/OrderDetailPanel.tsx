import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Card } from "../support/ui/Card";
import { AttemptsTable } from "./AttemptsTable";
import { CheckoutLinkPanel } from "./CheckoutLinkPanel";
import { getOrder, listAttempts, orderKeys } from "./orderApi";
import { OrderActions } from "./OrderActions";
import { OrderSummary } from "./OrderSummary";
import type { Payment } from "./types";

// Three more ticks after the last active attempt: the relay moves the order to PAID a moment
// after the attempt completes, and the refetch of that very tick can still see OPEN.
const GRACE_MS = 15_000;

const IN_FLIGHT = new Set(["PENDING", "AUTHORIZED", "CREATED"]);

function pollInterval(attempts: Payment[]): number | false {
  const inFlight = attempts.some((attempt) => IN_FLIGHT.has(attempt.status));
  return inFlight && document.visibilityState === "visible" ? 5_000 : false;
}

// Keyed by id: moving from one order to the next in the list must not carry the previous one's
// link, polling state or open dialog along.
export function OrderDetailPanel() {
  const { id = "" } = useParams();
  return <OrderDetail key={id} id={id} />;
}

function OrderDetail({ id }: { id: string }) {
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
    return (
      <p role="alert" className="text-danger">
        Não foi possível carregar a cobrança.
      </p>
    );
  }
  if (!order.data) {
    return <p className="text-muted">Carregando…</p>;
  }

  const data = order.data;

  // The workspace's right column, as in the mockup: the order on top, its attempts below.
  return (
    <section aria-label={`Cobrança ${data.id}`} className="space-y-4">
      <Card className="min-w-0 space-y-5">
        <OrderSummary order={data} />
        <CheckoutLinkPanel order={data} initialUrl={initialUrl}>
          <OrderActions order={data} attempts={attempts.data ?? []} />
        </CheckoutLinkPanel>
      </Card>

      <Card className="min-w-0">
        <h2 className="mb-2 font-display text-sm font-semibold">Tentativas</h2>
        <AttemptsTable attempts={attempts.data ?? []} />
      </Card>
    </section>
  );
}
