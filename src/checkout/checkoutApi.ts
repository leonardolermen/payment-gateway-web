import { request } from "../support/http";
import type { AttemptBody, Checkout, CheckoutPayment } from "./types";

// Public routes: the token in the path is the only credential, so no apiKey is ever sent.
function base(token: string): string {
  return `/v1/checkout/${encodeURIComponent(token)}`;
}

export async function getCheckout(token: string): Promise<Checkout> {
  const { data } = await request<Checkout>(base(token));

  return data;
}

export async function createAttempt(token: string, body: AttemptBody): Promise<CheckoutPayment> {
  const { data } = await request<CheckoutPayment>(`${base(token)}/payments`, {
    method: "POST",
    body,
  });

  return data;
}

export async function getAttempt(token: string, id: string): Promise<CheckoutPayment> {
  const { data } = await request<CheckoutPayment>(
    `${base(token)}/payments/${encodeURIComponent(id)}`,
  );

  return data;
}

export async function cancelAttempt(token: string, id: string): Promise<CheckoutPayment> {
  const { data } = await request<CheckoutPayment>(
    `${base(token)}/payments/${encodeURIComponent(id)}/cancel`,
    { method: "POST" },
  );

  return data;
}
