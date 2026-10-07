import type { Checkout, CheckoutPayment, Method } from "./types";

// What the paid screen can say about the payment: the method and, for a card, only what the
// receipt of any shop prints (brand, last four, installments). Never the number.
export type Receipt = {
  method: Method;
  brand: string | null;
  last4: string | null;
  installments: number | null;
};

export type State =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: "not_found" | "closed" }
  // authorizedOnly: a card the merchant has yet to capture. Inferring it from a null paidAt
  // made a PAID order (which carries no date here) read "autorizado".
  | { kind: "paid"; paidAt: string | null; authorizedOnly: boolean; receipt?: Receipt }
  | { kind: "choosing"; methods: Method[] }
  | { kind: "pix"; paymentId: string; copiaECola: string; expiresAt: string | null }
  | { kind: "boleto"; paymentId: string; linhaDigitavel: string; dueDate: string }
  | { kind: "card"; declined?: string }
  // A card attempt the acquirer has not answered yet: polled like a Pix, never the empty form.
  | { kind: "card_pending"; paymentId: string }
  | { kind: "failed"; message: string };

// The step a state stands for, in the URL as ?etapa=. Terminal states have none.
export type Step = "metodo" | "cartao" | "pix" | "boleto" | "confirmacao";

export type Event =
  | { type: "loaded"; checkout: Checkout }
  | { type: "load_failed"; status: number }
  | { type: "choose"; method: Method }
  | { type: "attempt_created"; payment: CheckoutPayment }
  | { type: "attempt_failed"; code: string; message: string }
  | { type: "polled"; payment: CheckoutPayment }
  | { type: "cancelled" }
  // The payer leaves the card form (button or browser back). Pix and boleto go back through
  // "cancelled", once the server has cancelled the attempt.
  | { type: "back" };

const DECLINED_MESSAGE = "Cartão recusado. Confira os dados ou tente outro cartão.";

// The state holds payment ids only, never card data, so no state dump can carry a number.
export function reduce(state: State, event: Event, checkout: Checkout | null): State {
  switch (event.type) {
    case "loaded":
      return fromCheckout(event.checkout);
    case "load_failed":
      return event.status === 404
        ? { kind: "unavailable", reason: "not_found" }
        : { kind: "failed", message: "Não foi possível carregar o pagamento." };
    case "choose":
      return event.method === "CARD" ? { kind: "card" } : state;
    case "attempt_created":
      return fromAttempt(event.payment, state);
    case "attempt_failed":
      return fromAttemptError(state, event.code);
    case "polled":
      return fromPoll(state, event.payment, checkout);
    case "cancelled":
      return choosingFrom(checkout);
    case "back":
      return state.kind === "card" ? choosingFrom(checkout) : state;
  }
}

export function stepOf(state: State): Step | null {
  switch (state.kind) {
    case "choosing":
      return "metodo";
    case "card":
      return "cartao";
    case "pix":
      return "pix";
    case "boleto":
      return "boleto";
    case "card_pending":
      return "confirmacao";
    default:
      return null;
  }
}

const STEP_ORDER: Step[] = ["metodo", "cartao", "pix", "boleto", "confirmacao"];

/** Whether moving from `from` to `to` is a step back, as the browser's back button would be. */
export function isStepBack(from: Step, to: Step | null): boolean {
  return to === "metodo" && STEP_ORDER.indexOf(from) > 0;
}

function receiptOf(payment: CheckoutPayment): Receipt {
  return {
    method: payment.method,
    brand: payment.card?.brand ?? null,
    last4: payment.card?.last4 ?? null,
    installments: payment.card?.installments ?? null,
  };
}

export function fromCheckout(checkout: Checkout): State {
  if (checkout.status === "PAID") {
    return { kind: "paid", paidAt: null, authorizedOnly: false };
  }
  if (checkout.status !== "OPEN") {
    return { kind: "unavailable", reason: "closed" };
  }

  const resumed = checkout.active_payment ? resume(checkout.active_payment) : null;

  return resumed ?? choosingFrom(checkout);
}

function resume(payment: CheckoutPayment): State | null {
  // The order can still read OPEN right after payment while the outbox relay catches up; a payer who
  // reloads then must see "paid", not the method chooser again.
  if (payment.status === "COMPLETED") {
    return {
      kind: "paid",
      paidAt: payment.paid_at,
      authorizedOnly: false,
      receipt: receiptOf(payment),
    };
  }

  // A synchronous card attempt that is only authorized is waiting on the merchant to capture.
  if (payment.method === "CARD" && payment.status === "AUTHORIZED") {
    return { kind: "paid", paidAt: null, authorizedOnly: true, receipt: receiptOf(payment) };
  }
  if (payment.status !== "PENDING") {
    return null;
  }
  if (payment.method === "CARD") {
    return { kind: "card_pending", paymentId: payment.id };
  }

  return pendingState(payment);
}

function pendingState(payment: CheckoutPayment): State | null {
  if (payment.method === "PIX" && payment.pix) {
    return {
      kind: "pix",
      paymentId: payment.id,
      copiaECola: payment.pix.copia_e_cola,
      expiresAt: payment.pix.expires_at,
    };
  }
  if (payment.method === "BOLECODE" && payment.boleto) {
    return {
      kind: "boleto",
      paymentId: payment.id,
      linhaDigitavel: payment.boleto.linha_digitavel,
      dueDate: payment.boleto.due_date,
    };
  }

  return null;
}

function fromAttempt(payment: CheckoutPayment, state: State): State {
  if (payment.method === "CARD") {
    return fromCardAttempt(payment, state);
  }

  return pendingState(payment) ?? state;
}

function fromCardAttempt(payment: CheckoutPayment, state: State): State {
  if (payment.status === "COMPLETED") {
    return {
      kind: "paid",
      paidAt: payment.paid_at,
      authorizedOnly: false,
      receipt: receiptOf(payment),
    };
  }
  if (payment.status === "AUTHORIZED") {
    return { kind: "paid", paidAt: null, authorizedOnly: true, receipt: receiptOf(payment) };
  }
  if (payment.status === "FAILED") {
    return { kind: "card", declined: DECLINED_MESSAGE };
  }
  // CREATED or PENDING: the acquirer has yet to answer. Staying on an emptied form said nothing.
  if (payment.status === "CREATED" || payment.status === "PENDING") {
    return { kind: "card_pending", paymentId: payment.id };
  }

  return state;
}

function fromAttemptError(state: State, code: string): State {
  if (code === "CHECKOUT_ORDER_CLOSED") {
    return { kind: "unavailable", reason: "closed" };
  }
  // Another attempt already exists: reloading resumes it instead of fighting it.
  if (code === "ORDER_HAS_ACTIVE_PAYMENT") {
    return { kind: "loading" };
  }

  return state;
}

function fromPoll(state: State, payment: CheckoutPayment, checkout: Checkout | null): State {
  if (payment.status === "COMPLETED") {
    return {
      kind: "paid",
      paidAt: payment.paid_at,
      authorizedOnly: false,
      receipt: receiptOf(payment),
    };
  }

  if (state.kind === "card_pending") {
    return fromPendingCardPoll(state, payment, checkout);
  }

  const isWaiting = state.kind === "pix" || state.kind === "boleto";
  const isOver =
    payment.status === "EXPIRED" || payment.status === "CANCELED" || payment.status === "FAILED";

  return isWaiting && isOver ? choosingFrom(checkout) : state;
}

function choosingFrom(checkout: Checkout | null): State {
  return { kind: "choosing", methods: checkout ? checkout.methods : [] };
}

function fromPendingCardPoll(
  state: State,
  payment: CheckoutPayment,
  checkout: Checkout | null,
): State {
  if (payment.status === "AUTHORIZED") {
    return { kind: "paid", paidAt: null, authorizedOnly: true, receipt: receiptOf(payment) };
  }
  if (payment.status === "FAILED") {
    return { kind: "card", declined: DECLINED_MESSAGE };
  }
  if (payment.status === "EXPIRED" || payment.status === "CANCELED") {
    return choosingFrom(checkout);
  }

  return state;
}
