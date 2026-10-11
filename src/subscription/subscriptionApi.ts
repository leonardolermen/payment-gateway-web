import type { Order } from "../order/types";
import { merchantRequest } from "../support/merchantRequest";
import type { Subscription, SubscriptionStatus } from "./types";

export const SUBSCRIPTION_PAGE_SIZE = 20;

export type SubscriptionListParams = {
  status?: SubscriptionStatus;
  customer_id?: string;
  cursor?: string;
  limit?: number;
};

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  // A plain array (the customer's history). The paged list lives under `page`: an infinite query
  // stores `{pages, pageParams}`, and sharing a key with an array would hand one the other's shape.
  list: (params: SubscriptionListParams) => ["subscriptions", "list", params] as const,
  page: (params: { status?: SubscriptionStatus }) => ["subscriptions", "page", params] as const,
  detail: (id: string) => ["subscriptions", id] as const,
  orders: (id: string) => ["subscriptions", id, "orders"] as const,
};

export async function listSubscriptions(params: SubscriptionListParams): Promise<Subscription[]> {
  const query = new URLSearchParams();

  if (params.status) {
    query.set("status", params.status);
  }
  if (params.customer_id) {
    query.set("customer_id", params.customer_id);
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

// Newest first, as the gateway sends them.
export async function listSubscriptionOrders(id: string): Promise<Order[]> {
  const { data } = await merchantRequest<Order[]>(`/v1/subscriptions/${id}/orders`);
  return data;
}
