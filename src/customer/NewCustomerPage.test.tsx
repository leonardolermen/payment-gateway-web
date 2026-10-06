import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { NewCustomerPage } from "./NewCustomerPage";

const CUSTOMERS = "http://localhost:8080/v1/customers";

async function submitWith(document: string) {
  storeApiKey("gk_test_abc");
  renderWithProviders([{ path: "/app/customers/new", element: <NewCustomerPage /> }], {
    initialEntries: ["/app/customers/new"],
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
    expect(screen.getByRole("link", { name: "Ver cliente" })).toHaveAttribute(
      "href",
      "/app/customers/cus_00000009",
    );
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
});
