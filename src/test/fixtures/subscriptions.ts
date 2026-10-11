import type { Subscription } from "../../subscription/types";

export function aSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_00000001",
    status: "ACTIVE",
    customer_id: "cus_00000001",
    customer_name: "Maria Souza",
    plan_id: "plan_00000001",
    method: "PIX",
    card_id: null,
    current_period: { start: "2026-10-06", end: "2026-11-06" },
    next_billing_at: "2026-11-06T12:00:00Z",
    cancel_at_period_end: false,
    latest_order: null,
    first_invoice: null,
    dunning: [],
    created_at: "2026-10-06T12:00:00Z",
    ...overrides,
  };
}
