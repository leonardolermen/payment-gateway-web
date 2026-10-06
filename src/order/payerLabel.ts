import type { Order } from "./types";

// No payer name on the order yet: the customer id is shortened until a later task enriches it.
export function payerLabel(order: Order): string {
  return order.customer_id ? `${order.customer_id.slice(0, 8)}…` : "pagador avulso";
}
