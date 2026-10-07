import { Outlet, useMatch } from "react-router";
import { Card } from "../support/ui/Card";
import { SubscriptionsList } from "./SubscriptionsList";

// The same layout as Cobranças: the list on the left, the chosen subscription on the right.
export function SubscriptionsWorkspace() {
  const selected = useMatch("/app/subscriptions/:id") !== null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
      <div className="min-w-0">
        <SubscriptionsList />
      </div>
      <div className={`min-w-0 ${selected ? "order-first lg:order-none" : ""}`}>
        <Outlet />
      </div>
    </div>
  );
}

export function NoSubscriptionSelected() {
  return (
    <Card className="hidden text-sm text-muted lg:block">
      Escolha uma assinatura para ver as faturas de cada ciclo e as ações.
    </Card>
  );
}
