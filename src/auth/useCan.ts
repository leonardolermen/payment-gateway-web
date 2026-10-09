import { can, type Action } from "./permissions";
import { useMe } from "./useMe";

// False while `me` is loading or missing: a READONLY user must never see a button flash in.
export function useCan(action: Action): boolean {
  const role = useMe().data?.user.role;

  return role !== undefined && can(role, action);
}
