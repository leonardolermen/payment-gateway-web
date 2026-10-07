import { createCustomer } from "../customer/customerApi";
import type { CustomerChoice } from "../customer/types";
import { GatewayRequestError } from "../support/gatewayError";
import type { PlanChoice } from "./planChoice";
import { createPlan, createSubscription } from "./subscriptionApi";
import type { Subscription, SubscriptionMethod } from "./types";

export type StartRequest = {
  customer: CustomerChoice;
  plan: PlanChoice;
  amount: number | null;
  name: string;
  method: SubscriptionMethod;
};

// One key per step, minted once per mounted form: a retry after a timeout replays each step that
// already reached the gateway instead of making a second customer, plan or subscription.
export type StepKeys = { customer: string; plan: string; subscription: string };

export function newStepKeys(): StepKeys {
  return {
    customer: crypto.randomUUID(),
    plan: crypto.randomUUID(),
    subscription: crypto.randomUUID(),
  };
}

async function customerIdOf(choice: CustomerChoice, key: string): Promise<string> {
  if ("customer_id" in choice) {
    return choice.customer_id;
  }
  try {
    return (await createCustomer(choice.customer, key)).id;
  } catch (e) {
    // The document is already a customer: the subscription is his, not a reason to stop.
    const existing =
      e instanceof GatewayRequestError && e.error.code === "CUSTOMER_EXISTS"
        ? e.error.extras.customer_id
        : undefined;
    if (typeof existing === "string") {
      return existing;
    }
    throw e;
  }
}

/** Customer (if new), plan (if new), then the subscription: the order the gateway needs them in. */
export async function startSubscription(
  request: StartRequest,
  keys: StepKeys,
): Promise<Subscription> {
  const customerId = await customerIdOf(request.customer, keys.customer);

  let planId: string;
  if (request.plan.kind === "existing") {
    planId = request.plan.planId;
  } else {
    if (request.amount === null) {
      throw new Error("amount is required for a new plan");
    }
    const plan = await createPlan(
      {
        name: request.name,
        amount: request.amount,
        currency: "BRL",
        interval: request.plan.interval,
        interval_count: request.plan.intervalCount,
        trial_days: request.plan.trialDays,
      },
      keys.plan,
    );
    planId = plan.id;
  }

  return createSubscription(
    { customer_id: customerId, plan_id: planId, method: request.method },
    keys.subscription,
  );
}
