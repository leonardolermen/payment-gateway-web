import { useState } from "react";
import { Outlet, useMatch } from "react-router";
import { useCan } from "../auth/useCan";
import { Workspace, WorkspaceEmpty } from "../support/ui/Workspace";
import { NewOrderForm } from "./NewOrderForm";
import { OrdersList } from "./OrdersList";

export function OrdersWorkspace() {
  const mayCreateCharge = useCan("create_charge");
  const selected = useMatch("/app/orders/:id") !== null;
  // Bumped after a create: a fresh form is a fresh idempotency key, and the next charge starts empty.
  const [formGeneration, setFormGeneration] = useState(0);

  function focusNewOrder() {
    const amount = document.getElementById("amount");
    amount?.scrollIntoView({ block: "center", behavior: "smooth" });
    amount?.focus({ preventScroll: true });
  }

  return (
    <Workspace
      selected={selected}
      left={
        <>
          <OrdersList onNewOrder={focusNewOrder} />
          {mayCreateCharge && (
            <NewOrderForm
              key={formGeneration}
              onCreated={() => setFormGeneration((generation) => generation + 1)}
            />
          )}
        </>
      }
    >
      <Outlet />
    </Workspace>
  );
}

export function NoOrderSelected() {
  return (
    <WorkspaceEmpty>
      Escolha uma cobrança na lista para ver o link, as tentativas e as ações.
    </WorkspaceEmpty>
  );
}
