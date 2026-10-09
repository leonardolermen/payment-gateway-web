import type { ComponentProps } from "react";
import { roleLabel } from "../../auth/roleLabels";
import type { Role } from "../../auth/types";
import { INPUT_CLASSES } from "../../support/ui/inputClasses";

const ROLES: Role[] = ["OWNER", "FINANCE", "READONLY"];

type Props = Omit<ComponentProps<"select">, "value" | "onChange"> & {
  value: Role;
  onChange: (role: Role) => void;
};

export function RoleSelect({ value, onChange, className = "", ...select }: Props) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as Role)}
      className={`${INPUT_CLASSES} ${className}`}
      {...select}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {roleLabel(role)}
        </option>
      ))}
    </select>
  );
}
