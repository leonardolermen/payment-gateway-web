import type { Customer, SavedCard } from "../../customer/types";

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

export function aSavedCard(overrides: Partial<SavedCard> = {}): SavedCard {
  return {
    id: "card_00000001",
    brand: "VISA",
    last4: "4242",
    expiry: "08/2029",
    holder: "MARIA SOUZA",
    created_at: "2026-10-06T12:00:00Z",
    ...overrides,
  };
}
