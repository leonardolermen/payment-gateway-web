import { describe, expect, it } from "vitest";
import { fromCheckout, reduce, type State } from "./checkoutState";
import type { Checkout, CheckoutPayment } from "./types";

function aPayment(overrides: Partial<CheckoutPayment> = {}): CheckoutPayment {
  return {
    id: "pay_1",
    method: "PIX",
    status: "PENDING",
    pix: { copia_e_cola: "000201pix", expires_at: "2026-10-06T12:00:00Z" },
    boleto: null,
    card: null,
    paid_at: null,
    created_at: "2026-10-06T11:00:00Z",
    ...overrides,
  };
}

function aCheckout(overrides: Partial<Checkout> = {}): Checkout {
  return {
    order_id: "ord_1",
    merchant_name: "Loja",
    amount: 1000,
    currency: "BRL",
    description: "Pedido",
    status: "OPEN",
    expires_at: "2026-10-07T00:00:00Z",
    methods: ["PIX", "BOLECODE", "CARD"],
    active_payment: null,
    ...overrides,
  };
}

const aBoleto = {
  linha_digitavel: "123",
  due_date: "2026-10-10",
  payment_limit_date: "2026-10-12",
};

const choosing: State = { kind: "choosing", methods: ["PIX", "CARD"] };
const pix: State = { kind: "pix", paymentId: "pay_1", copiaECola: "c", expiresAt: null };

describe("fromCheckout", () => {
  it("aPaidOrderIsPaidOnLoad", () => {
    expect(fromCheckout(aCheckout({ status: "PAID" }))).toEqual({
      kind: "paid",
      paidAt: null,
      authorizedOnly: false,
    });
  });

  it("aClosedOrderIsUnavailable", () => {
    const closed = { kind: "unavailable", reason: "closed" };
    expect(fromCheckout(aCheckout({ status: "CANCELED" }))).toEqual(closed);
    expect(fromCheckout(aCheckout({ status: "EXPIRED" }))).toEqual(closed);
  });

  it("anActivePixOnLoadResumesPolling", () => {
    expect(fromCheckout(aCheckout({ active_payment: aPayment() }))).toEqual({
      kind: "pix",
      paymentId: "pay_1",
      copiaECola: "000201pix",
      expiresAt: "2026-10-06T12:00:00Z",
    });
  });

  it("anActiveBoletoOnLoadResumesTheBoleto", () => {
    const payment = aPayment({ id: "pay_2", method: "BOLECODE", pix: null, boleto: aBoleto });
    expect(fromCheckout(aCheckout({ active_payment: payment }))).toEqual({
      kind: "boleto",
      paymentId: "pay_2",
      linhaDigitavel: "123",
      dueDate: "2026-10-10",
    });
  });

  it("anAuthorizedCardOnLoadIsPaidWithoutDate", () => {
    const payment = aPayment({ method: "CARD", status: "AUTHORIZED", pix: null });
    expect(fromCheckout(aCheckout({ active_payment: payment }))).toEqual({
      kind: "paid",
      paidAt: null,
      authorizedOnly: true,
    });
  });

  it("neverThrowsOnUnexpectedCombos", () => {
    const payment = aPayment({ pix: null });
    expect(fromCheckout(aCheckout({ active_payment: payment }))).toEqual({
      kind: "choosing",
      methods: ["PIX", "BOLECODE", "CARD"],
    });
  });

  it("aCompletedActivePaymentOnAnOpenOrderIsPaid", () => {
    const payment = aPayment({ status: "COMPLETED", paid_at: "2026-10-06T11:05:00Z" });
    expect(fromCheckout(aCheckout({ active_payment: payment }))).toEqual({
      kind: "paid",
      paidAt: "2026-10-06T11:05:00Z",
      authorizedOnly: false,
    });
  });

  it("aNonPendingActivePaymentFallsBackToChoosing", () => {
    const payment = aPayment({ method: "CARD", status: "FAILED", pix: null });
    expect(fromCheckout(aCheckout({ active_payment: payment })).kind).toBe("choosing");
  });
});

describe("authorizedOnly", () => {
  it("aPaidOrderIsConfirmedEvenWithoutADate", () => {
    expect(fromCheckout(aCheckout({ status: "PAID" }))).toMatchObject({ authorizedOnly: false });
  });

  it("aCompletedPollIsConfirmed", () => {
    const payment = aPayment({ status: "COMPLETED" });
    expect(reduce(pix, { type: "polled", payment }, null)).toMatchObject({ authorizedOnly: false });
  });

  it("aCompletedAttemptIsConfirmedAndOnlyAnAuthorizedCardIsAuthorizedOnly", () => {
    const completed = aPayment({ method: "CARD", status: "COMPLETED" });
    const authorized = aPayment({ method: "CARD", status: "AUTHORIZED" });
    const card: State = { kind: "card" };
    expect(reduce(card, { type: "attempt_created", payment: completed }, null)).toMatchObject({
      authorizedOnly: false,
    });
    expect(fromCheckout(aCheckout({ active_payment: authorized }))).toMatchObject({
      authorizedOnly: true,
    });
  });
});

describe("reduce", () => {
  it("loadedRunsFromCheckout", () => {
    const state = reduce({ kind: "loading" }, { type: "loaded", checkout: aCheckout() }, null);
    expect(state).toEqual({ kind: "choosing", methods: ["PIX", "BOLECODE", "CARD"] });
  });

  it("aNotFoundLoadIsUnavailable", () => {
    const state = reduce({ kind: "loading" }, { type: "load_failed", status: 404 }, null);
    expect(state).toEqual({ kind: "unavailable", reason: "not_found" });
  });

  it("anotherLoadFailureIsFailed", () => {
    const state = reduce({ kind: "loading" }, { type: "load_failed", status: 500 }, null);
    expect(state.kind).toBe("failed");
  });

  it("choosingCardOpensTheCardForm", () => {
    expect(reduce(choosing, { type: "choose", method: "CARD" }, null)).toEqual({ kind: "card" });
  });

  it("choosingPixKeepsChoosingUntilTheAttemptExists", () => {
    expect(reduce(choosing, { type: "choose", method: "PIX" }, null)).toBe(choosing);
  });

  it("aCreatedPixAttemptShowsThePix", () => {
    const state = reduce(choosing, { type: "attempt_created", payment: aPayment() }, null);
    expect(state).toMatchObject({ kind: "pix", paymentId: "pay_1" });
  });

  it("aCreatedBoletoAttemptShowsTheBoleto", () => {
    const payment = aPayment({ method: "BOLECODE", pix: null, boleto: aBoleto });
    const state = reduce(choosing, { type: "attempt_created", payment }, null);
    expect(state).toMatchObject({ kind: "boleto", linhaDigitavel: "123" });
  });

  it("aCompletedCardAttemptIsPaid", () => {
    const payment = aPayment({
      method: "CARD",
      status: "COMPLETED",
      paid_at: "2026-10-06T11:05:00Z",
    });
    expect(reduce({ kind: "card" }, { type: "attempt_created", payment }, null)).toEqual({
      kind: "paid",
      paidAt: "2026-10-06T11:05:00Z",
      authorizedOnly: false,
    });
  });

  it("anAuthorizedCardAttemptIsPaid", () => {
    const payment = aPayment({ method: "CARD", status: "AUTHORIZED" });
    expect(reduce({ kind: "card" }, { type: "attempt_created", payment }, null)).toEqual({
      kind: "paid",
      paidAt: null,
      authorizedOnly: true,
    });
  });

  it("aDeclinedCardStaysOnCardWithTheMessage", () => {
    const payment = aPayment({ method: "CARD", status: "FAILED" });
    const state = reduce({ kind: "card" }, { type: "attempt_created", payment }, null);
    expect(state.kind).toBe("card");
    expect(state.kind === "card" && state.declined).toBeTruthy();
  });

  it("aClosedErrorDuringAttemptIsUnavailable", () => {
    const event = { type: "attempt_failed", code: "CHECKOUT_ORDER_CLOSED", message: "x" } as const;
    expect(reduce(choosing, event, null)).toEqual({ kind: "unavailable", reason: "closed" });
  });

  it("anActivePaymentErrorReloads", () => {
    const event = {
      type: "attempt_failed",
      code: "ORDER_HAS_ACTIVE_PAYMENT",
      message: "x",
    } as const;
    expect(reduce(choosing, event, null)).toEqual({ kind: "loading" });
  });

  it("aRateLimitKeepsTheSameState", () => {
    const event = { type: "attempt_failed", code: "RATE_LIMITED", message: "x" } as const;
    expect(reduce(choosing, event, null)).toBe(choosing);
  });

  it("aCompletedPollIsPaidWithItsDate", () => {
    const payment = aPayment({ status: "COMPLETED", paid_at: "2026-10-06T11:10:00Z" });
    expect(reduce(pix, { type: "polled", payment }, null)).toEqual({
      kind: "paid",
      paidAt: "2026-10-06T11:10:00Z",
      authorizedOnly: false,
    });
  });

  it("anExpiredPixGoesBackToChoosing", () => {
    const payment = aPayment({ status: "EXPIRED" });
    const state = reduce(pix, { type: "polled", payment }, aCheckout({ methods: ["PIX"] }));
    expect(state).toEqual({ kind: "choosing", methods: ["PIX"] });
  });

  it("aFailedPollWithoutCheckoutChoosesFromAnEmptyList", () => {
    const boleto: State = { kind: "boleto", paymentId: "p", linhaDigitavel: "1", dueDate: "d" };
    const payment = aPayment({ status: "CANCELED" });
    expect(reduce(boleto, { type: "polled", payment }, null)).toEqual({
      kind: "choosing",
      methods: [],
    });
  });

  it("aPendingPollKeepsTheState", () => {
    expect(reduce(pix, { type: "polled", payment: aPayment() }, null)).toBe(pix);
  });

  it("aFailedPollFromPixOrBoletoGoesBackToChoosing", () => {
    const boleto: State = { kind: "boleto", paymentId: "p", linhaDigitavel: "1", dueDate: "d" };
    const payment = aPayment({ status: "FAILED" });
    const checkout = aCheckout({ methods: ["PIX", "CARD"] });
    const expected = { kind: "choosing", methods: ["PIX", "CARD"] };
    expect(reduce(pix, { type: "polled", payment }, checkout)).toEqual(expected);
    expect(reduce(boleto, { type: "polled", payment }, checkout)).toEqual(expected);
  });

  it("choosingPixWhileOnPixKeepsThePaymentId", () => {
    expect(reduce(pix, { type: "choose", method: "PIX" }, null)).toBe(pix);
  });

  it("aPixAttemptWithoutPixDataKeepsTheState", () => {
    const payment = aPayment({ pix: null });
    expect(reduce(choosing, { type: "attempt_created", payment }, null)).toBe(choosing);
  });

  it("cancelledGoesBackToChoosing", () => {
    const checkout = aCheckout({ methods: ["PIX", "CARD"] });
    expect(reduce(pix, { type: "cancelled" }, checkout)).toEqual({
      kind: "choosing",
      methods: ["PIX", "CARD"],
    });
  });
});
