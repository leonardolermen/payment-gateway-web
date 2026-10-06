import { merchantRequest } from "../support/merchantRequest";
import type { Customer, NewCustomer } from "./types";

export const CUSTOMER_PAGE_SIZE = 20;

export const customerKeys = {
  all: ["customers"] as const,
  list: ["customers", "list"] as const,
};

type ListParams = { cursor?: string; limit?: number };

export async function listCustomers(params: ListParams): Promise<Customer[]> {
  const query = new URLSearchParams();
  if (params.cursor) {
    query.set("cursor", params.cursor);
  }
  query.set("limit", String(params.limit ?? CUSTOMER_PAGE_SIZE));

  const { data } = await merchantRequest<Customer[]>(`/v1/customers?${query.toString()}`);
  return data;
}

// The API answers with a list of zero or one item.
export async function findByDocument(document: string): Promise<Customer | null> {
  const query = new URLSearchParams({ document });
  const { data } = await merchantRequest<Customer[]>(`/v1/customers?${query.toString()}`);
  return data[0] ?? null;
}

export async function createCustomer(
  body: NewCustomer,
  idempotencyKey: string,
): Promise<Customer> {
  const { data } = await merchantRequest<Customer>("/v1/customers", {
    method: "POST",
    body,
    idempotencyKey,
  });
  return data;
}
