import type { Order, PaymentMethod } from "../order/types";

export type SubscriptionStatus =
  "ACTIVE" | "PAST_DUE" | "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "CANCELED" | "ENDED";

export type DunningAttempt = {
  attempt: number;
  scheduled_at: string;
  ran_at: string | null;
  outcome: string | null;
};

// Field names mirror the API (snake_case) on purpose, as in order/types.ts.
export type Subscription = {
  id: string;
  status: SubscriptionStatus;
  customer_id: string;
  // Null once the customer was deleted.
  customer_name: string | null;
  plan_id: string;
  method: PaymentMethod;
  card_id: string | null;
  current_period: { start: string; end: string } | null;
  next_billing_at: string | null;
  cancel_at_period_end: boolean;
  latest_order: Order | null;
  dunning: DunningAttempt[];
  created_at: string;
};
