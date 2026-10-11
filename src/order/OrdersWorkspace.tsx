import { useEffect, useState } from "react";
import { Outlet, useMatch, useSearchParams } from "react-router";
import { useCan } from "../auth/useCan";
import { Workspace, WorkspaceEmpty } from "../support/ui/Workspace";
import { NewOrderForm } from "./NewOrderForm";
import { OrdersList } from "./OrdersList";

export function OrdersWorkspace() {
  const mayCreateCharge = useCan("create_charge");
  const selected = useMatch("/app/orders/:id") !== null;
  // Bumped after a create: a fresh form is a fresh idempotency key, and the next charge starts empty.
  const [formGeneration, setFormGeneration] = useState(0);

  // The customer page's "Nova cobrança" shortcut sends only the id. Read once and dropped from the
  // URL: a reload or a copied link must not keep choosing that customer, and the form after a
  // create starts empty.
  const [searchParams, setSearchParams] = useSearchParams();
  const [preselectedCustomerId] = useState(() => searchParams.get("customer_id"));

  useEffect(() => {
    if (searchParams.has("customer_id")) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("customer_id");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

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
              preselectedCustomerId={formGeneration === 0 ? preselectedCustomerId : null}
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
