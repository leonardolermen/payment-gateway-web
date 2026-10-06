import { useState } from "react";
import { Outlet, useMatch } from "react-router";
import { Card } from "../support/ui/Card";
import { NewOrderForm } from "./NewOrderForm";
import { OrdersList } from "./OrdersList";

// The panel's home, laid out like the approved mockup: the list and the new-charge form on the
// left, the selected order on the right. One column below 1024px, with the selected order first so
// a tap on a row shows it without scrolling past the list.
export function OrdersWorkspace() {
  const selected = useMatch("/app/orders/:id") !== null;
  // Bumped after a create: a fresh form is a fresh idempotency key, and the next charge starts empty.
  const [formGeneration, setFormGeneration] = useState(0);

  function focusNewOrder() {
    const amount = document.getElementById("amount");
    amount?.scrollIntoView({ block: "center", behavior: "smooth" });
    amount?.focus({ preventScroll: true });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
      <div className="min-w-0 space-y-5">
        <OrdersList onNewOrder={focusNewOrder} />
        <NewOrderForm
          key={formGeneration}
          onCreated={() => setFormGeneration((generation) => generation + 1)}
        />
      </div>

      <div className={`min-w-0 ${selected ? "order-first lg:order-none" : ""}`}>
        <Outlet />
      </div>
    </div>
  );
}

export function NoOrderSelected() {
  return (
    <Card className="text-sm text-muted">
      Escolha uma cobrança na lista para ver o link, as tentativas e as ações.
    </Card>
  );
}
