import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
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
