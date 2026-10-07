import type { Order } from "../order/types";
import { merchantRequest } from "../support/merchantRequest";
import type { NewPlan, NewSubscription, Plan, Subscription, SubscriptionStatus } from "./types";

export const SUBSCRIPTION_PAGE_SIZE = 20;

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  list: (status?: SubscriptionStatus) => ["subscriptions", "list", status ?? "all"] as const,
  detail: (id: string) => ["subscriptions", id] as const,
  invoices: (id: string) => ["subscriptions", id, "invoices"] as const,
  plans: ["plans", "active"] as const,
};

export async function listActivePlans(): Promise<Plan[]> {
  const { data } = await merchantRequest<Plan[]>("/v1/plans?active=true");
  return data;
}

export async function createPlan(body: NewPlan, idempotencyKey: string): Promise<Plan> {
  const { data } = await merchantRequest<Plan>("/v1/plans", {
    method: "POST",
    body,
    idempotencyKey,
  });
  return data;
}

export async function createSubscription(
  body: NewSubscription,
  idempotencyKey: string,
): Promise<Subscription> {
  const { data } = await merchantRequest<Subscription>("/v1/subscriptions", {
    method: "POST",
    body,
    idempotencyKey,
  });
  return data;
}

type ListParams = { status?: SubscriptionStatus; cursor?: string; limit?: number };

export async function listSubscriptions(params: ListParams): Promise<Subscription[]> {
  const query = new URLSearchParams();
  if (params.status) {
    query.set("status", params.status);
  }
  if (params.cursor) {
    query.set("cursor", params.cursor);
  }
  query.set("limit", String(params.limit ?? SUBSCRIPTION_PAGE_SIZE));

  const { data } = await merchantRequest<Subscription[]>(`/v1/subscriptions?${query.toString()}`);
  return data;
}

export async function getSubscription(id: string): Promise<Subscription> {
  const { data } = await merchantRequest<Subscription>(`/v1/subscriptions/${id}`);
  return data;
}

export async function listInvoices(id: string): Promise<Order[]> {
  const { data } = await merchantRequest<Order[]>(`/v1/subscriptions/${id}/orders`);
  return data;
}

export async function cancelSubscription(
  id: string,
  atPeriodEnd: boolean,
  idempotencyKey: string,
): Promise<Subscription> {
  const { data } = await merchantRequest<Subscription>(`/v1/subscriptions/${id}/cancel`, {
    method: "POST",
    body: { at_period_end: atPeriodEnd },
    idempotencyKey,
  });
  return data;
}
