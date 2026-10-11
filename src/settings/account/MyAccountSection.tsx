import { useMe } from "../../auth/useMe";
import { PasswordCard } from "./PasswordCard";
import { RenameCard } from "./RenameCard";
import { SessionsCard } from "./SessionsCard";

export function MyAccountSection() {
  const me = useMe();

  return (
    <div className="space-y-4">
      {/* Keyed by the loaded name so the field starts prefilled instead of empty. */}
      {me.data && <RenameCard key={me.data.user.name} currentName={me.data.user.name} />}
      <PasswordCard />
      <SessionsCard />
    </div>
  );
}
