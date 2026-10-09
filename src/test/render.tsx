import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { meKeys } from "../auth/authApi";
import type { Me } from "../auth/types";

type Options = { initialEntries?: string[]; me?: Me };

// A fresh client per test with retry off: a 401 must surface once, not after three silent retries.
export function renderWithProviders(routes: RouteObject[], options: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Seeded, not fetched: a screen that gates on the role must not need an await to show its buttons.
  if (options.me) {
    queryClient.setQueryData(meKeys.me, options.me);
  }

  const router = createMemoryRouter(routes, { initialEntries: options.initialEntries ?? ["/"] });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { ...view, router, queryClient };
}
