import type { Subscription, SubscriptionStatus } from "./types";

// The gateway's isBillable: only these change method or cancel at the end of the period; any other
// status answers 409 SUBSCRIPTION_NOT_ACTIVE.
const BILLABLE = new Set<SubscriptionStatus>(["ACTIVE", "PAST_DUE"]);

export function isBillable(subscription: Subscription): boolean {
  return BILLABLE.has(subscription.status);
}

// INCOMPLETE (waiting for the first payment) has no period to end at, but may be dropped now.
export function mayBeCanceled(subscription: Subscription): boolean {
  return isBillable(subscription) || subscription.status === "INCOMPLETE";
}

// Already scheduled for the end of the period, or no period at all: "now" is the only choice left.
export function cancelsOnlyNow(subscription: Subscription): boolean {
  return subscription.cancel_at_period_end || subscription.status === "INCOMPLETE";
}
