import type { Checkout, CheckoutPayment, Method } from "./types";

export type State =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: "not_found" | "closed" }
  | { kind: "paid"; paidAt: string | null }
  | { kind: "choosing"; methods: Method[] }
  | { kind: "pix"; paymentId: string; copiaECola: string; expiresAt: string | null }
  | { kind: "boleto"; paymentId: string; linhaDigitavel: string; dueDate: string }
  | { kind: "card"; declined?: string }
  | { kind: "failed"; message: string };

export type Event =
  | { type: "loaded"; checkout: Checkout }
  | { type: "load_failed"; status: number }
  | { type: "choose"; method: Method }
  | { type: "attempt_created"; payment: CheckoutPayment }
  | { type: "attempt_failed"; code: string; message: string }
  | { type: "polled"; payment: CheckoutPayment }
  | { type: "cancelled" };

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
  }
}

export function fromCheckout(checkout: Checkout): State {
  if (checkout.status === "PAID") {
    return { kind: "paid", paidAt: null };
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
    return { kind: "paid", paidAt: payment.paid_at };
  }

  // A synchronous card attempt that is only authorized is waiting on the merchant to capture.
  if (payment.method === "CARD" && payment.status === "AUTHORIZED") {
    return { kind: "paid", paidAt: null };
  }
  if (payment.status !== "PENDING") {
    return null;
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
    return { kind: "paid", paidAt: payment.paid_at };
  }
  if (payment.status === "AUTHORIZED") {
    return { kind: "paid", paidAt: null };
  }
  if (payment.status === "FAILED") {
    return { kind: "card", declined: DECLINED_MESSAGE };
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
    return { kind: "paid", paidAt: payment.paid_at };
  }

  const isWaiting = state.kind === "pix" || state.kind === "boleto";
  const isOver =
    payment.status === "EXPIRED" || payment.status === "CANCELED" || payment.status === "FAILED";

  return isWaiting && isOver ? choosingFrom(checkout) : state;
}

function choosingFrom(checkout: Checkout | null): State {
  return { kind: "choosing", methods: checkout ? checkout.methods : [] };
}
