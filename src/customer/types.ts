// Field names mirror the API (snake_case) on purpose, as in order/types.ts.
export type Address = {
  street: string;
  district: string;
  city: string;
  state: string;
  zip: string;
};

export type Customer = {
  id: string;
  name: string;
  // Already masked by the API: the panel never holds a full document it did not just type.
  document: string;
  email: string | null;
  address: Address | null;
  created_at: string;
  updated_at: string;
};

// A card the gateway vaulted for this customer; the panel only ever sees the brand and last four.
export type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  // "MM/YYYY", as the API sends it.
  expiry: string;
  holder: string;
  created_at: string;
};

export type NewCustomer = {
  name: string;
  document: string;
  email?: string;
  address?: Address;
};

// Only what changed goes out: the API answers 400 to an empty body, and the address is replaced
// as a whole, never merged field by field.
export type CustomerPatch = {
  name?: string;
  email?: string;
  address?: Address;
};

export type CustomerChoice = { customer_id: string } | { customer: NewCustomer };
