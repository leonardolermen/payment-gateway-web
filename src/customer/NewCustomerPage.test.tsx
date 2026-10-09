import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../auth/session";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { NewCustomerPage } from "./NewCustomerPage";

const CUSTOMERS = "http://localhost:8080/v1/customers";

async function submitWith(document: string) {
  setAccessToken("gs_test");
  renderWithProviders([{ path: "/app/customers/new", element: <NewCustomerPage /> }], {
    initialEntries: ["/app/customers/new"],
    me: aMe({ role: "FINANCE" }),
  });
  await userEvent.type(screen.getByLabelText("Nome"), "Ana Lima");
  await userEvent.type(screen.getByLabelText("Documento"), document);
  await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

describe("NewCustomerPage", () => {
  it("aDuplicateShowsTheExistingCustomer", async () => {
    server.use(
      http.post(CUSTOMERS, () =>
        HttpResponse.json(
          { type: "urn:gateway:CUSTOMER_EXISTS", status: 409, customer_id: "cus_00000009" },
          { status: 409 },
        ),
      ),
    );

    await submitWith("12345678909");

    expect(await screen.findByText("Já existe um cliente com este documento.")).toBeInTheDocument();
    expect(screen.getByText("cus_00000009")).toBeInTheDocument();
  });

  it("aFieldErrorLandsOnItsInput", async () => {
    server.use(
      http.post(CUSTOMERS, () =>
        HttpResponse.json(
          {
            type: "urn:gateway:CUSTOMER_INVALID",
            status: 422,
            detail: "customer.document is not a valid CPF or CNPJ",
            field: "customer.document",
          },
          { status: 422 },
        ),
      ),
    );

    await submitWith("12345678909");

    const input = await screen.findByLabelText("Documento");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("customer.document is not a valid CPF or CNPJ")).toBeInTheDocument();
  });

  it("readonlyIsSentBackToTheList", async () => {
    const { router } = renderWithProviders(
      [
        { path: "/app/customers/new", element: <NewCustomerPage /> },
        { path: "/app/customers", element: <p>Lista de clientes</p> },
      ],
      { initialEntries: ["/app/customers/new"], me: aMe({ role: "READONLY" }) },
    );

    expect(await screen.findByText("Lista de clientes")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/app/customers");
  });
});
