import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLocation, useNavigationType, useParams, useSearchParams } from "react-router";
import { formatDateTime } from "../support/dates";
import { GatewayRequestError } from "../support/gatewayError";
import { formatBrl } from "../support/money";
import { ThemeToggle } from "../support/ui/ThemeToggle";
import { BoletoStep } from "./BoletoStep";
import { CardPendingStep } from "./CardPendingStep";
import { CardStep } from "./CardStep";
import { getCheckout } from "./checkoutApi";
import { isStepBack, reduce, stepOf, type Event, type State, type Step } from "./checkoutState";
import { ChooseMethod } from "./ChooseMethod";
import { PaidScreen } from "./PaidScreen";
import { PixStep } from "./PixStep";
import { StepIndicator } from "./StepIndicator";
import type { Checkout } from "./types";
import { UnavailableScreen } from "./UnavailableScreen";
import { useLeaveAttempt } from "./useLeaveAttempt";

// The checkout travels with each action instead of being read from a ref, so the reducer stays pure.
type Action =
  | { kind: "event"; event: Event; checkout: Checkout | null }
  | { kind: "refreshed"; checkout: Checkout };

// A refetch must never yank the payer out of a step in progress (a QR code on screen, a card form
// half typed); only these states are safe to re-derive from the server. "failed" is a failed
// load, so the retry's answer has to land.
const REDERIVABLE: State["kind"][] = ["loading", "choosing", "paid", "failed"];

// What a screen reader hears when the step changes; the heading also takes the focus.
const ANNOUNCEMENTS: Partial<Record<State["kind"], string>> = {
  choosing: "Escolha a forma de pagamento",
  card: "Pagamento com cartão",
  card_pending: "Confirmando o pagamento",
  pix: "Pix gerado",
  boleto: "Boleto gerado",
  paid: "Pagamento concluído",
  unavailable: "Pagamento indisponível",
};

function reduceAction(state: State, action: Action): State {
  if (action.kind === "event") {
    return reduce(state, action.event, action.checkout);
  }

  if (!REDERIVABLE.includes(state.kind)) {
    return state;
  }

  return reduce(state, { type: "loaded", checkout: action.checkout }, action.checkout);
}

type Props = {
  // Test-only window into the reducer: the card sweep proves no state ever carries card data.
  onStateChange?: (state: State) => void;
};

export function PayPage({ onStateChange }: Props) {
  const { token = "" } = useParams();
  const checkout = useQuery({
    queryKey: ["checkout", token],
    queryFn: () => getCheckout(token),
  });
  const [state, dispatchAction] = useReducer(reduceAction, { kind: "loading" });

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

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

  const leaving = useLeaveAttempt(token, send);
  const leaveCurrent = useCallback(async (): Promise<boolean> => {
    if (state.kind === "card") {
      send({ type: "back" });
      return true;
    }
    if (state.kind === "pix" || state.kind === "boleto") {
      return leaving.leave(state.paymentId);
    }
    return false;
  }, [state, send, leaving]);

  useStepInUrl(state, leaveCurrent);
  useStepFocus(state.kind);

  return (
    <main className="min-h-screen bg-bg px-4 py-8 text-ink sm:py-16">
      <div className="mx-auto max-w-[440px] rounded-card border border-line bg-surface p-6 shadow-sm">
        {data && (
          <header className="mb-6 border-b border-line pb-5">
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">
              {data.merchant_name}
            </p>
            <p className="mt-2 font-display text-4xl font-semibold">{formatBrl(data.amount)}</p>
            <p className="mt-1 text-muted">{data.plan_name ?? data.description}</p>
            {data.expires_at && data.status === "OPEN" && (
              <p className="mt-1 text-xs text-muted">Vence em {formatDateTime(data.expires_at)}</p>
            )}
          </header>
        )}
        {stepOf(state) && <StepIndicator step={stepOf(state) as Step} />}
        <div key={state.kind} className="animate-step-in">
          {renderStep(state, token, data, send, () => void refetch(), {
            onLeave: () => void leaveCurrent(),
            isLeaving: leaving.isLeaving,
            leaveError: leaving.error,
          })}
        </div>
        <p role="status" className="sr-only">
          {ANNOUNCEMENTS[state.kind] ?? ""}
        </p>
      </div>
      <footer className="mx-auto mt-4 flex max-w-[440px] justify-end">
        <ThemeToggle />
      </footer>
    </main>
  );
}

/**
 * The step lives in ?etapa= so the browser's back button steps back instead of leaving the page.
 * Moving forward is a new history entry; a load, a resume or an ending replaces the entry. The
 * server's state always wins: a URL asking for a step the state is not in is rewritten.
 */
function useStepInUrl(state: State, leaveCurrent: () => Promise<boolean>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const location = useLocation();
  const step = stepOf(state);
  const urlStep = searchParams.get("etapa");
  const lastStep = useRef<Step | null>(null);

  const writeStep = useCallback(
    (next: Step | null, replace: boolean) => {
      setSearchParams(
        (params) => {
          const copy = new URLSearchParams(params);
          if (next) {
            copy.set("etapa", next);
          } else {
            copy.delete("etapa");
          }
          return copy;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    const previous = lastStep.current;
    if (step === previous) {
      return;
    }
    lastStep.current = step;
    if (urlStep === step) {
      return;
    }
    writeStep(step, previous === null || step === null);
    // Only a change of step writes the URL; reading urlStep here would fight the browser's pops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, writeStep]);

  useEffect(() => {
    const current = lastStep.current;
    if (navigationType !== "POP" || current === null || urlStep === current) {
      return;
    }

    if (isStepBack(current, urlStep as Step | null)) {
      void leaveCurrent().then((left) => {
        if (!left) {
          // Could not leave (a confirming card, a cancel the server refused): stay, and put the
          // step back so the next back press tries again.
          writeStep(current, false);
        }
      });
      return;
    }

    writeStep(current, true);
    // Runs per history entry; the step and the leave handler are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
}

/** Moves the focus to the new step's heading, so keyboard and screen reader users follow it. */
function useStepFocus(kind: State["kind"]) {
  const previous = useRef<State["kind"]>("loading");

  useEffect(() => {
    const before = previous.current;
    previous.current = kind;
    // The first screen after the load keeps the browser's own focus; only a change moves it.
    if (before === "loading" || before === kind) {
      return;
    }
    document.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [kind]);
}

type LeaveProps = { onLeave: () => void; isLeaving: boolean; leaveError: string | null };

function renderStep(
  state: State,
  token: string,
  checkout: Checkout | null,
  send: (event: Event) => void,
  retry: () => void,
  leave: LeaveProps,
) {
  switch (state.kind) {
    case "loading":
      return (
        <div aria-busy="true" className="space-y-3">
          <div className="h-5 w-2/3 animate-pulse rounded bg-surface-muted" />
          <div className="h-11 animate-pulse rounded-pill bg-surface-muted" />
        </div>
      );
    case "unavailable":
      return <UnavailableScreen reason={state.reason} />;
    case "paid":
      return (
        <PaidScreen
          amount={checkout?.amount ?? null}
          paidAt={state.paidAt}
          authorizedOnly={state.authorizedOnly}
          receipt={state.receipt}
        />
      );
    case "choosing":
      return (
        <ChooseMethod
          token={token}
          methods={state.methods}
          send={send}
          maxInstallments={checkout?.installment_options?.at(-1)?.count}
        />
      );
    case "pix":
      return <PixStep token={token} step={state} send={send} {...leave} />;
    case "boleto":
      return <BoletoStep token={token} step={state} send={send} {...leave} />;
    case "card":
      return (
        <CardStep
          token={token}
          amount={checkout?.amount ?? 0}
          installmentOptions={checkout?.installment_options ?? []}
          subscriptionPlan={
            checkout?.saves_card_for_subscription ? (checkout.plan_name ?? null) : undefined
          }
          declined={state.declined}
          send={send}
        />
      );
    case "card_pending":
      return <CardPendingStep token={token} step={state} send={send} />;
    case "failed":
      return (
        <div role="alert">
          <p className="text-danger">{state.message}</p>
          <button type="button" className="mt-2 text-accent underline" onClick={retry}>
            Tentar de novo
          </button>
        </div>
      );
  }
}
