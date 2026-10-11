import type { Role } from "./types";

export type Action =
  | "create_charge"
  | "cancel"
  | "refund"
  | "capture"
  | "rotate_checkout_link"
  | "create_customer"
  | "delete_customer"
  | "edit_customer"
  | "delete_card"
  | "create_plan"
  | "edit_plan"
  | "create_subscription"
  | "cancel_subscription"
  | "change_subscription_method"
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
  // Rotating kills the link the payer already holds, so it is a write like any other.
  rotate_checkout_link: "FINANCE",
  create_customer: "FINANCE",
  delete_customer: "OWNER",
  edit_customer: "OWNER",
  // A saved card may be what keeps a subscription paying; removing it is the owner's call.
  delete_card: "OWNER",
  create_plan: "FINANCE",
  edit_plan: "FINANCE",
  create_subscription: "FINANCE",
  cancel_subscription: "FINANCE",
  change_subscription_method: "FINANCE",
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
