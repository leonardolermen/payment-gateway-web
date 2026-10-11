import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useCan } from "../auth/useCan";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { buttonClasses } from "../support/ui/buttonClasses";
import { PageHeader } from "../support/ui/PageHeader";
import { CustomerDataCard } from "./CustomerDataCard";
import { CustomerHistoryCard } from "./CustomerHistoryCard";
import { customerKeys, getCustomer } from "./customerApi";
import { DeleteCustomerDialog } from "./DeleteCustomerDialog";
import { SavedCardsCard } from "./SavedCardsCard";

function BackToCustomers() {
  return (
    <Link to="/app/customers" className="text-sm text-muted hover:underline">
      <span aria-hidden="true">← </span>Clientes
    </Link>
  );
}

// Keyed by id: going from one customer to the next must not carry a row's open dialog or error.
export function CustomerDetailPage() {
  const { id = "" } = useParams();
  return <CustomerDetail key={id} id={id} />;
}

function CustomerDetail({ id }: { id: string }) {
  const mayCreateCharge = useCan("create_charge");
  const mayDeleteCustomer = useCan("delete_customer");
  const [deleting, setDeleting] = useState(false);
  const customer = useQuery({ queryKey: customerKeys.detail(id), queryFn: () => getCustomer(id) });

  if (customer.isError) {
    return (
      <section className="space-y-4">
        <BackToCustomers />
        <p role="alert" className="text-danger">
          {messageFor(customer.error)}
        </p>
      </section>
    );
  }

  if (!customer.data) {
    return (
      <p role="status" className="text-muted">
        Carregando…
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <BackToCustomers />

      <PageHeader
        title={customer.data.name}
        action={
          mayCreateCharge ? (
            // Only the id goes in the URL, never the name or document; the orders form resolves it.
            <Link to={`/app/orders?customer_id=${id}`} className={buttonClasses()}>
              Nova cobrança
            </Link>
          ) : undefined
        }
      />

      <CustomerDataCard customer={customer.data} />
      <SavedCardsCard customerId={id} />
      <CustomerHistoryCard customerId={id} />

      {/* Discreet on purpose, at the bottom: it is the one action here that cannot be undone. */}
      {mayDeleteCustomer && (
        <footer className="border-t border-line pt-4">
          <Button variant="danger-ghost" size="sm" onClick={() => setDeleting(true)}>
            Excluir cliente
          </Button>
        </footer>
      )}

      {deleting && (
        <DeleteCustomerDialog customer={customer.data} onClose={() => setDeleting(false)} />
      )}
    </section>
  );
}
