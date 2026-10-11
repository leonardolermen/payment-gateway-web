import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import { aMe, mockMe } from "../test/me";
import { aCustomer } from "../test/fixtures/customers";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { CustomersPage } from "./CustomersPage";

function renderPage(role: Role = "OWNER") {
  setAccessToken("gs_test");
  mockMe(aMe({ role }));
  server.use(
    http.get("http://localhost:8080/v1/customers", () => HttpResponse.json([aCustomer()])),
  );

  return renderWithProviders([{ path: "/app/customers", element: <CustomersPage /> }], {
    initialEntries: ["/app/customers"],
  });
}

describe("CustomersPage", () => {
  it("listsCustomersWithTheDocumentAsReturned", async () => {
    setAccessToken("gs_test");
    mockMe(aMe({ role: "OWNER" }));
    server.use(
      http.get("http://localhost:8080/v1/customers", () => HttpResponse.json([aCustomer()])),
    );

    renderWithProviders([{ path: "/app/customers", element: <CustomersPage /> }], {
      initialEntries: ["/app/customers"],
    });

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("***.982.247-**")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("searchesByDocumentOrName", async () => {
    const searches: string[] = [];
    setAccessToken("gs_test");
    mockMe(aMe({ role: "OWNER" }));
    server.use(
      http.get("http://localhost:8080/v1/customers", ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json([aCustomer()]);
      }),
    );
    renderWithProviders([{ path: "/app/customers", element: <CustomersPage /> }], {
      initialEntries: ["/app/customers"],
    });
    await screen.findByText("Maria Souza");
    const search = screen.getByLabelText("Buscar por nome ou documento");

    await userEvent.type(search, "529.982.247-25");
    await vi.waitFor(() => expect(searches.at(-1)).toBe("?document=52998224725"));

    await userEvent.clear(search);
    await userEvent.type(search, "Maria Souza");
    await vi.waitFor(() => expect(searches.at(-1)).toBe("?q=Maria+Souza&limit=20"));

    // Keystrokes are debounced: no partial name ever reaches the gateway.
    expect(searches.some((query) => query.startsWith("?q=Mar&"))).toBe(false);
  });

  it("rowsLinkToTheDetail", async () => {
    renderPage();

    expect(await screen.findByRole("link", { name: "Maria Souza" })).toHaveAttribute(
      "href",
      "/app/customers/cus_00000001",
    );
  });

  it("hidesNewCustomerFromReadonly", async () => {
    renderPage("READONLY");

    await screen.findByText("Maria Souza");

    expect(screen.queryByRole("link", { name: /Novo cliente/ })).not.toBeInTheDocument();
  });

  it("showsNewCustomerToFinance", async () => {
    renderPage("FINANCE");

    expect(await screen.findByRole("link", { name: /Novo cliente/ })).toBeInTheDocument();
  });
});
