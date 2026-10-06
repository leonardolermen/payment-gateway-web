import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { aCustomer } from "../test/fixtures/customers";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { CustomersPage } from "./CustomersPage";

describe("CustomersPage", () => {
  it("listsCustomersWithTheDocumentAsReturned", async () => {
    storeApiKey("gk_test_abc");
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
});
