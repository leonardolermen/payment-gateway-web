import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useCan } from "../auth/useCan";
import { messageFor } from "../support/gatewayError";
import { buttonClasses } from "../support/ui/buttonClasses";
import { PageHeader } from "../support/ui/PageHeader";
import { CustomerDataCard } from "./CustomerDataCard";
import { CustomerHistoryCard } from "./CustomerHistoryCard";
import { customerKeys, getCustomer } from "./customerApi";
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
    return null;
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
    </section>
  );
}
