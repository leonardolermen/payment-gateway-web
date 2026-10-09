import type { Role } from "./types";

export type Action =
  | "create_charge"
  | "cancel"
  | "refund"
  | "capture"
  | "create_customer"
  | "delete_customer"
  | "create_plan"
  | "edit_plan"
  | "create_subscription"
  | "webhooks"
  | "api_keys"
  | "providers"
  | "installments"
  | "team"
  | "store";

// The API enforces the same table; this one only hides what the server would refuse.
const MINIMUM: Record<Action, Role> = {
  create_charge: "FINANCE",
  cancel: "FINANCE",
  refund: "FINANCE",
  capture: "FINANCE",
  create_customer: "FINANCE",
  delete_customer: "OWNER",
  create_plan: "FINANCE",
  edit_plan: "FINANCE",
  create_subscription: "FINANCE",
  webhooks: "OWNER",
  api_keys: "OWNER",
  providers: "OWNER",
  installments: "OWNER",
  team: "OWNER",
  store: "OWNER",
};

const RANK: Record<Role, number> = { READONLY: 0, FINANCE: 1, OWNER: 2 };

export function can(role: Role, action: Action): boolean {
  return RANK[role] >= RANK[MINIMUM[action]];
}
