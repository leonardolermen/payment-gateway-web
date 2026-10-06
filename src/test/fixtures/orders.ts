import type { Order, Payment } from "../../order/types";

export function anOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord_00000001",
    status: "OPEN",
    amount: 4990,
    currency: "BRL",
    reference: null,
    description: "Plano mensal",
    customer_id: null,
    customer_name: null,
    paid_payment_id: null,
    paid_at: null,
    expires_at: "2026-10-10T15:00:00Z",
    subscription_id: null,
    invoice_number: null,
    period: null,
    payments: [],
    created_at: "2026-10-06T12:00:00Z",
    checkout_url: null,
    ...overrides,
  };
}

export function aPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay_00000001",
    status: "PENDING",
    method: "PIX",
    provider: "SIMULATED",
    environment: "TEST",
    amount: 4990,
    currency: "BRL",
    reference: null,
    order_id: "ord_00000001",
    description: null,
    pix: null,
    boleto: null,
    card: null,
    expires_at: null,
    paid_at: null,
    paid_amount: null,
    refunded_amount: null,
    created_at: "2026-10-06T12:01:00Z",
    ...overrides,
  };
}
