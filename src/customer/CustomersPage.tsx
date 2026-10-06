import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { formatDateTime } from "../support/dates";
import { Button } from "../support/ui/Button";
import { buttonClasses } from "../support/ui/buttonClasses";
import { Card } from "../support/ui/Card";
import { PageHeader } from "../support/ui/PageHeader";
import { Table } from "../support/ui/Table";
import { CUSTOMER_PAGE_SIZE, customerKeys, listCustomers } from "./customerApi";

const HEADERS = ["Nome", "Documento", "E-mail", "Criado em"];

export function CustomersPage() {
  const query = useInfiniteQuery({
    queryKey: customerKeys.list,
    queryFn: ({ pageParam }) => listCustomers({ cursor: pageParam, limit: CUSTOMER_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length < CUSTOMER_PAGE_SIZE ? undefined : last.at(-1)?.id),
  });

  const customers = query.data?.pages.flat() ?? [];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Clientes"
        action={
          <Link to="/app/customers/new" className={buttonClasses()}>
            <span aria-hidden="true">+</span>Novo cliente
          </Link>
        }
      />

      {query.isError && (
        <p role="alert" className="text-danger">
          Não foi possível carregar os clientes.
        </p>
      )}

      <Card className="p-0 sm:p-2">
        <Table headers={HEADERS}>
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-surface-muted">
              <td className="font-medium">{customer.name}</td>
              <td className="font-mono text-xs">{customer.document}</td>
              <td>{customer.email ?? "—"}</td>
              <td className="whitespace-nowrap text-muted">
                {formatDateTime(customer.created_at)}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {query.isSuccess && customers.length === 0 && (
        <p className="text-center text-muted">Nenhum cliente por aqui.</p>
      )}

      {query.hasNextPage && (
        <Button
          variant="ghost"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          Carregar mais
        </Button>
      )}
    </section>
  );
}
