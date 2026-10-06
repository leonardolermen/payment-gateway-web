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

export type NewCustomer = {
  name: string;
  document: string;
  email?: string;
  address?: Address;
};

export type CustomerChoice = { customer_id: string } | { customer: NewCustomer };
