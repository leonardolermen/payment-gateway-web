import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer } from "react";
import { useParams } from "react-router";
import { GatewayRequestError } from "../support/gatewayError";
import { formatBrl } from "../support/money";
import { BoletoStep } from "./BoletoStep";
import { CardStep } from "./CardStep";
import { getCheckout } from "./checkoutApi";
import { reduce, type Event, type State } from "./checkoutState";
import { ChooseMethod } from "./ChooseMethod";
import { PaidScreen } from "./PaidScreen";
import { PixStep } from "./PixStep";
import type { Checkout } from "./types";
import { UnavailableScreen } from "./UnavailableScreen";

// The checkout travels with each action instead of being read from a ref, so the reducer stays pure.
type Action =
  | { kind: "event"; event: Event; checkout: Checkout | null }
  | { kind: "refreshed"; checkout: Checkout };

// A refetch must never yank the payer out of a step in progress (a QR code on screen, a card form
// half typed); only these states are safe to re-derive from the server. "failed" is a failed
// load, so the retry's answer has to land.
const REDERIVABLE: State["kind"][] = ["loading", "choosing", "paid", "failed"];

function reduceAction(state: State, action: Action): State {
  if (action.kind === "event") {
    return reduce(state, action.event, action.checkout);
  }

  if (!REDERIVABLE.includes(state.kind)) {
    return state;
  }

  return reduce(state, { type: "loaded", checkout: action.checkout }, action.checkout);
}

export function PayPage() {
  const { token = "" } = useParams();
  const checkout = useQuery({
    queryKey: ["checkout", token],
    queryFn: () => getCheckout(token),
  });
  const [state, dispatchAction] = useReducer(reduceAction, { kind: "loading" });

  const data = checkout.data ?? null;
  const send = useCallback(
    (event: Event) => dispatchAction({ kind: "event", event, checkout: data }),
    [data],
  );

  // Keyed on dataUpdatedAt, not data: structural sharing hands back the same object when nothing
  // changed, and a reload must still re-derive (a payer who paid elsewhere sees "paid").
  useEffect(() => {
    if (checkout.data) {
      dispatchAction({ kind: "refreshed", checkout: checkout.data });
    }
  }, [checkout.dataUpdatedAt, checkout.data]);

  useEffect(() => {
    if (checkout.error) {
      const status =
        checkout.error instanceof GatewayRequestError ? checkout.error.error.status : 0;
      dispatchAction({ kind: "event", event: { type: "load_failed", status }, checkout: null });
    }
  }, [checkout.error]);

  // ORDER_HAS_ACTIVE_PAYMENT sends the reducer back to loading: the server knows the live attempt.
  const { refetch } = checkout;
  const isReloading = state.kind === "loading" && checkout.data !== undefined;
  useEffect(() => {
    if (isReloading) {
      void refetch();
    }
  }, [isReloading, refetch]);

  return (
    <main className="mx-auto max-w-md p-4">
      {data && (
        <header className="mb-6">
          <p className="text-sm text-gray-600">{data.merchant_name}</p>
          <p className="text-3xl font-semibold">{formatBrl(data.amount)}</p>
          <p className="text-gray-700">{data.description}</p>
        </header>
      )}
      {renderStep(state, token, data, send, () => void refetch())}
    </main>
  );
}

function renderStep(
  state: State,
  token: string,
  checkout: Checkout | null,
  send: (event: Event) => void,
  retry: () => void,
) {
  switch (state.kind) {
    case "loading":
      return <p>Carregando…</p>;
    case "unavailable":
      return <UnavailableScreen reason={state.reason} />;
    case "paid":
      return <PaidScreen amount={checkout?.amount ?? null} paidAt={state.paidAt} />;
    case "choosing":
      return <ChooseMethod token={token} methods={state.methods} send={send} />;
    case "pix":
      return <PixStep token={token} step={state} send={send} />;
    case "boleto":
      return <BoletoStep token={token} step={state} send={send} />;
    case "card":
      return <CardStep token={token} declined={state.declined} send={send} />;
    case "failed":
      return (
        <div role="alert">
          <p>{state.message}</p>
          <button type="button" className="mt-2 underline" onClick={retry}>
            Tentar de novo
          </button>
        </div>
      );
  }
}
