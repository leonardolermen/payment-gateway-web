import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { can } from "../auth/permissions";
import type { Role } from "../auth/types";
import { useMe } from "../auth/useMe";
import { PageHeader } from "../support/ui/PageHeader";
import { Tabs } from "../support/ui/Tabs";
import { MyAccountSection } from "./account/MyAccountSection";
import { StoreSection } from "./account/StoreSection";
import { InstallmentSettingsForm } from "./InstallmentSettingsForm";
import { TeamSection } from "./team/TeamSection";

type SettingsTab = {
  id: string;
  label: string;
  allows: (role: Role) => boolean;
  content: ReactNode;
};

const EVERYONE = () => true;

const TABS: SettingsTab[] = [
  { id: "account", label: "Conta", allows: EVERYONE, content: <StoreSection /> },
  { id: "profile", label: "Minha conta", allows: EVERYONE, content: <MyAccountSection /> },
  {
    id: "installments",
    label: "Parcelamento",
    allows: (role) => can(role, "installments"),
    content: <InstallmentSettingsForm />,
  },
  {
    id: "team",
    label: "Equipe",
    allows: (role) => can(role, "team"),
    content: <TeamSection />,
  },
];

// The tab lives in the URL so the user menu can deep-link to "Minha conta"; a tab the role
// cannot use falls back to Conta instead of rendering a panel the API would refuse.
export function SettingsPage() {
  const me = useMe();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!me.data) {
    return <PageHeader title="Configurações" />;
  }

  const role = me.data.user.role;
  const allowed = TABS.filter((tab) => tab.allows(role));
  const selected = allowed.find((tab) => tab.id === searchParams.get("tab")) ?? allowed[0]!;

  return (
    <section className="space-y-4">
      <PageHeader title="Configurações" />
      <Tabs tabs={allowed} selected={selected.id} onSelect={(id) => setSearchParams({ tab: id })} />
      {selected.content}
    </section>
  );
}
