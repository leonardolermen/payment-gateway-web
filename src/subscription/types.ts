import type { Order, PaymentMethod } from "../order/types";

export type SubscriptionStatus =
  "ACTIVE" | "PAST_DUE" | "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "CANCELED" | "ENDED";

// ISSUED: a Pix or boleto went out and waits for the payer; the attempt ends there.
export type DunningOutcome = "PAID" | "DECLINED" | "ISSUED" | "EXPIRED" | "SKIPPED";

export type DunningAttempt = {
  attempt: number;
  scheduled_at: string;
  ran_at: string | null;
  outcome: DunningOutcome | null;
};

export type FirstInvoice = { order_id: string; checkout_url: string };

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
  // Only on the POST that answers INCOMPLETE (CARD without card_id): the first invoice's checkout
  // link, handed out once. Null on every GET.
  first_invoice: FirstInvoice | null;
  dunning: DunningAttempt[];
  created_at: string;
};

// CARD without card_id: the gateway answers INCOMPLETE and the payer registers the card through
// first_invoice.checkout_url. start_at is a São Paulo calendar day, "YYYY-MM-DD".
export type NewSubscription = {
  customer_id: string;
  plan_id: string;
  method: PaymentMethod;
  card_id?: string;
  start_at?: string;
};

// card_id goes only with CARD: the gateway charges that saved card from the next invoice on.
export type SubscriptionMethodChange =
  { method: "PIX" | "BOLECODE" } | { method: "CARD"; card_id: string };
