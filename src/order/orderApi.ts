import type { QueryClient } from "@tanstack/react-query";
import { merchantRequest } from "../support/merchantRequest";
import type { CustomerChoice } from "../customer/types";
import type { Order, OrderStatus, Payment } from "./types";

export const PAGE_SIZE = 20;

type ListParams = { status?: OrderStatus; cursor?: string; limit?: number };

export const orderKeys = {
  all: ["orders"] as const,
  list: (params: ListParams) => ["orders", "list", params] as const,
  detail: (id: string) => ["orders", id] as const,
  attempts: (id: string) => ["orders", id, "attempts"] as const,
};

export async function listOrders(params: ListParams): Promise<Order[]> {
  const query = new URLSearchParams();
  if (params.status) {
    query.set("status", params.status);
  }
  if (params.cursor) {
    query.set("cursor", params.cursor);
  }
  query.set("limit", String(params.limit ?? PAGE_SIZE));

  const { data } = await merchantRequest<Order[]>(`/v1/orders?${query.toString()}`);
  return data;
}

export async function getOrder(id: string): Promise<Order> {
  const { data } = await merchantRequest<Order>(`/v1/orders/${id}`);
  return data;
}

export async function listAttempts(id: string): Promise<Payment[]> {
  const { data } = await merchantRequest<Payment[]>(`/v1/orders/${id}/payments`);
  return data;
}

export type NewOrder = {
  amount: number;
  currency: "BRL";
  reference?: string;
  description?: string;
  expires_at?: string;
} & CustomerChoice;

// The caller owns the key: it is minted once per mounted form so a retry replays the same order.
export async function createOrder(body: NewOrder, idempotencyKey: string): Promise<Order> {
  const { data } = await merchantRequest<Order>("/v1/orders", {
    method: "POST",
    body,
    idempotencyKey,
  });
  return data;
}

// The detail, its attempts and every list all show a piece of the same order: refreshing one
// leaves the others telling the old story.
export async function invalidateOrder(queryClient: QueryClient, id: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) }),
    queryClient.invalidateQueries({ queryKey: orderKeys.attempts(id) }),
    queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  ]);
}

// Idempotency keys are minted by the caller once per click, so a double click replays one action.
export async function cancelOrder(id: string, idempotencyKey: string): Promise<Order> {
  const { data } = await merchantRequest<Order>(`/v1/orders/${id}/cancel`, {
    method: "POST",
    idempotencyKey,
  });
  return data;
}

export async function rotateCheckoutToken(id: string, idempotencyKey: string): Promise<Order> {
  const { data } = await merchantRequest<Order>(`/v1/orders/${id}/checkout-token/rotate`, {
    method: "POST",
    idempotencyKey,
  });
  return data;
}

// Omitting the amount means a full refund; the API answers 201 or 202, both are success here.
export async function refundPayment(
  paymentId: string,
  amount: number | undefined,
  idempotencyKey: string,
): Promise<void> {
  await merchantRequest(`/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    body: amount === undefined ? undefined : { amount },
    idempotencyKey,
  });
}
