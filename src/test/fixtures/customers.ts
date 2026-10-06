import type { Customer } from "../../customer/types";

export function aCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cus_00000001",
    name: "Maria Souza",
    document: "***.982.247-**",
    email: "maria@example.com",
    address: null,
    created_at: "2026-10-06T12:00:00Z",
    updated_at: "2026-10-06T12:00:00Z",
    ...overrides,
  };
}
