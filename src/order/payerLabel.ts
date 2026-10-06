import type { Order } from "./types";

// A deleted customer keeps its id on the order but loses the name; the short id still tells two
// such orders apart.
export function payerLabel(order: Order): string {
  if (order.customer_name) {
    return order.customer_name;
  }
  return order.customer_id ? `${order.customer_id.slice(0, 8)}…` : "pagador avulso";
}
