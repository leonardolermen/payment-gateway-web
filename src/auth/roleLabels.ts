import type { Role } from "./types";

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Dono",
  FINANCE: "Financeiro",
  READONLY: "Leitura",
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}
