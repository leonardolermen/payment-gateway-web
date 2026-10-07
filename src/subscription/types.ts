import type { Order } from "../order/types";

// Field names mirror the API (snake_case) on purpose, as in order/types.ts.
export type PlanInterval = "DAY" | "WEEK" | "MONTH" | "YEAR";

export type Plan = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: PlanInterval;
  interval_count: number;
  trial_days: number;
  active: boolean;
  created_at: string;
};

export type NewPlan = {
  name: string;
  amount: number;
  currency: "BRL";
  interval: PlanInterval;
  interval_count: number;
  trial_days: number;
};

// INCOMPLETE and INCOMPLETE_EXPIRED: a card subscription waiting on its first invoice, paid by link
// (gateway spec 2026-10-07-assinatura-por-link).
export type SubscriptionStatus =
  "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "ENDED";

export type SubscriptionMethod = "CARD" | "PIX" | "BOLECODE";

export type Subscription = {
  id: string;
  status: SubscriptionStatus;
  customer_id: string;
  customer_name: string | null;
  plan_id: string;
  plan_name: string | null;
  amount: number | null;
  interval: PlanInterval | null;
  interval_count: number | null;
  method: SubscriptionMethod;
  card_id: string | null;
  current_period: { start: string; end: string } | null;
  next_billing_at: string | null;
  cancel_at_period_end: boolean;
  latest_order: Order | null;
  created_at: string;
  // Only on the create's response: the link of an invoice is shown once, like an order's.
  first_invoice?: { order_id: string; checkout_url: string | null } | null;
};

export type NewSubscription = {
  customer_id: string;
  plan_id: string;
  method: SubscriptionMethod;
};
