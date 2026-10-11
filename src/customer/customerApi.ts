import { merchantRequest } from "../support/merchantRequest";
import { onlyDigits } from "./document";
import type { Customer, NewCustomer } from "./types";

export const CUSTOMER_PAGE_SIZE = 20;

export type CustomerFilter = { q?: string; document?: string };

export const customerKeys = {
  all: ["customers"] as const,
  list: (search: CustomerFilter) => ["customers", "list", search] as const,
  detail: (id: string) => ["customers", id] as const,
  cards: (id: string) => ["customers", id, "cards"] as const,
};

type ListParams = CustomerFilter & { cursor?: string; limit?: number };

// `document` is exact and answers 0 or 1 customer, so it goes alone: no cursor, no limit.
export async function listCustomers(params: ListParams): Promise<Customer[]> {
  const query = new URLSearchParams();

  if (params.document) {
    query.set("document", onlyDigits(params.document));
  } else {
    if (params.q) {
      query.set("q", params.q);
    }
    if (params.cursor) {
      query.set("cursor", params.cursor);
    }
    query.set("limit", String(params.limit ?? CUSTOMER_PAGE_SIZE));
  }

  const { data } = await merchantRequest<Customer[]>(`/v1/customers?${query.toString()}`);
  return data;
}

// The API answers with a list of zero or one item.
export async function findByDocument(document: string): Promise<Customer | null> {
  const customers = await listCustomers({ document });
  return customers[0] ?? null;
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
