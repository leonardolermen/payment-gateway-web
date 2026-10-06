import { expect } from "vitest";
import type { Checkout, CheckoutPayment } from "../../checkout/types";

export const CHECKOUT_URL = "http://localhost:8080/v1/checkout/tok_abc";

export function aCheckout(overrides: Partial<Checkout> = {}): Checkout {
  return {
    order_id: "ord_00000001",
    merchant_name: "Loja Exemplo",
    amount: 4990,
    currency: "BRL",
    description: "Plano mensal",
    status: "OPEN",
    expires_at: "2026-10-10T15:00:00Z",
    methods: ["PIX", "BOLECODE", "CARD"],
    active_payment: null,
    ...overrides,
  };
}

export function aCheckoutPayment(overrides: Partial<CheckoutPayment> = {}): CheckoutPayment {
  return {
    id: "pay_1",
    method: "PIX",
    status: "PENDING",
    pix: { copia_e_cola: "000201pixcopiaecola", expires_at: "2099-01-01T00:00:00Z" },
    boleto: null,
    card: null,
    paid_at: null,
    created_at: "2026-10-06T12:00:00Z",
    ...overrides,
  };
}

// Public routes: the token is the only credential, and a merchant key sent here would be a leak.
export function expectNoAuthorization(request: Request): void {
  expect(request.headers.has("authorization")).toBe(false);
}
