import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { formatDateTime } from "../support/dates";
import { CUSTOMER_PAGE_SIZE, customerKeys, listCustomers } from "./customerApi";

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Link to="/app/customers/new" className="rounded bg-black px-3 py-2 text-sm text-white">
          Novo cliente
        </Link>
      </div>

      {query.isError && <p role="alert">Não foi possível carregar os clientes.</p>}

      <table className="w-full text-left text-sm">
        <thead className="text-gray-500">
          <tr>
            <th className="py-2">Nome</th>
            <th>Documento</th>
            <th>E-mail</th>
            <th>Criado em</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className="border-t">
              <td className="py-2">{customer.name}</td>
              <td>{customer.document}</td>
              <td>{customer.email ?? "—"}</td>
              <td>{formatDateTime(customer.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {query.isSuccess && customers.length === 0 && <p>Nenhum cliente por aqui.</p>}

      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="rounded border px-3 py-2 text-sm"
        >
          Carregar mais
        </button>
      )}
    </section>
  );
}
