import { useState } from "react";
import { PageHeader } from "../support/ui/PageHeader";
import { Tabs } from "../support/ui/Tabs";
import { AccountSection } from "./AccountSection";
import { InstallmentSettingsForm } from "./InstallmentSettingsForm";

const TABS = [
  { id: "account", label: "Conta" },
  { id: "installments", label: "Parcelamento" },
];

export function SettingsPage() {
  const [tab, setTab] = useState("account");

  return (
    <section className="space-y-4">
      <PageHeader title="Configurações" />
      <Tabs tabs={TABS} selected={tab} onSelect={setTab} />
      {tab === "account" ? <AccountSection /> : <InstallmentSettingsForm />}
    </section>
  );
}
