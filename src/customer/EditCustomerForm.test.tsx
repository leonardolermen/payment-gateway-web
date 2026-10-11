import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import { aCustomer } from "../test/fixtures/customers";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { customerKeys } from "./customerApi";
import { EditCustomerForm } from "./EditCustomerForm";
import type { Customer } from "./types";

const CUSTOMER = "http://localhost:8080/v1/customers/cus_00000001";

const WITH_ADDRESS = aCustomer({
  address: {
    street: "Rua das Flores, 10",
    district: "Centro",
    city: "Curitiba",
    state: "PR",
    zip: "80010000",
  },
});

function renderForm(customer: Customer = WITH_ADDRESS) {
  setAccessToken("gs_test");
  const onClose = vi.fn();
  const view = renderWithProviders(
    [
      {
        path: "/app/customers/:id",
        element: <EditCustomerForm customer={customer} onClose={onClose} />,
      },
    ],
    { initialEntries: ["/app/customers/cus_00000001"], me: aMe({ role: "OWNER" }) },
  );
  return { ...view, onClose };
}

function capturePatch(answer: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(CUSTOMER, async ({ request }) => {
      bodies.push(await request.json());
      return answer();
    }),
  );
  return bodies;
}

describe("EditCustomerForm", () => {
  it("prefillsFromTheCustomerAndHasNoDocumentInput", () => {
    renderForm();

    expect(screen.getByLabelText("Nome")).toHaveValue("Maria Souza");
    expect(screen.getByLabelText("E-mail")).toHaveValue("maria@example.com");
    expect(screen.getByLabelText("Cidade")).toHaveValue("Curitiba");
    expect(screen.getByLabelText("CEP")).toHaveValue("80010000");

    expect(screen.queryByLabelText("Documento")).not.toBeInTheDocument();
    expect(screen.getByText("***.982.247-**")).toBeInTheDocument();
    expect(screen.getByText("O documento não muda.")).toBeInTheDocument();
  });

  it("keepsSaveDisabledWhileNothingChanged", async () => {
    renderForm();
    const save = screen.getByRole("button", { name: "Salvar" });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Nome"), "x");
    expect(save).toBeEnabled();

    await userEvent.type(screen.getByLabelText("Nome"), "{Backspace}");
    expect(save).toBeDisabled();
  });

  it("sendsOnlyTheChangedFieldsAndUpdatesTheCache", async () => {
    const saved = { ...WITH_ADDRESS, email: "maria@novo.com" };
    const bodies = capturePatch(() => HttpResponse.json(saved));
    const { queryClient, onClose } = renderForm();
    queryClient.setQueryData(customerKeys.detail("cus_00000001"), WITH_ADDRESS);

    await userEvent.clear(screen.getByLabelText("E-mail"));
    await userEvent.type(screen.getByLabelText("E-mail"), "maria@novo.com");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ email: "maria@novo.com" }]);
    expect(queryClient.getQueryData(customerKeys.detail("cus_00000001"))).toEqual(saved);
  });

  // The detail refetches on focus and on an interval elsewhere; a refetch landing mid-edit must not
  // make an untouched field look changed against the newer customer.
  it("aRefetchMidEditKeepsTheBaselineItOpenedWith", async () => {
    setAccessToken("gs_test");
    const bodies = capturePatch(() => HttpResponse.json(WITH_ADDRESS));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onClose = vi.fn();
    const form = (customer: Customer) => (
      <QueryClientProvider client={queryClient}>
        <EditCustomerForm customer={customer} onClose={onClose} />
      </QueryClientProvider>
    );
    const { rerender } = render(form(WITH_ADDRESS));

    await userEvent.type(screen.getByLabelText("Nome"), " Lima");
    rerender(form({ ...WITH_ADDRESS, email: "outro@example.com" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ name: "Maria Souza Lima" }]);
  });

  it("anyAddressChangeSendsTheWholeAddress", async () => {
    const bodies = capturePatch(() => HttpResponse.json(WITH_ADDRESS));
    const { onClose } = renderForm();

    await userEvent.clear(screen.getByLabelText("Cidade"));
    await userEvent.type(screen.getByLabelText("Cidade"), "Londrina");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([
      {
        address: {
          street: "Rua das Flores, 10",
          district: "Centro",
          city: "Londrina",
          state: "PR",
          zip: "80010000",
        },
      },
    ]);
  });

  it("aFieldErrorLandsOnItsInput", async () => {
    capturePatch(() =>
      HttpResponse.json(
        {
          type: "urn:gateway:CUSTOMER_INVALID",
          status: 422,
          detail: "customer.address.zip must have 8 digits",
        },
        { status: 422 },
      ),
    );
    const { onClose } = renderForm();

    await userEvent.clear(screen.getByLabelText("CEP"));
    await userEvent.type(screen.getByLabelText("CEP"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("customer.address.zip must have 8 digits")).toBeInTheDocument();
    expect(screen.getByLabelText("CEP")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("anErrorWithoutAFieldGoesToTheFormAlert", async () => {
    capturePatch(() =>
      HttpResponse.json(
        { type: "urn:gateway:INVALID_REQUEST", status: 400, detail: "unknown field" },
        { status: 400 },
      ),
    );
    renderForm();

    await userEvent.type(screen.getByLabelText("Nome"), " Lima");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Requisição inválida.");
  });

  it("cancelClosesWithoutARequest", async () => {
    const bodies = capturePatch(() => HttpResponse.json(WITH_ADDRESS));
    const { onClose } = renderForm();

    await userEvent.type(screen.getByLabelText("Nome"), " Lima");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
    expect(bodies).toEqual([]);
  });

  // The gateway names the field only in the detail; one the form has no input for still shows.
  it("anInvalidCustomerWithoutAKnownFieldShowsTheDetail", async () => {
    capturePatch(() =>
      HttpResponse.json(
        { type: "urn:gateway:CUSTOMER_INVALID", status: 422, detail: "customer is incomplete" },
        { status: 422 },
      ),
    );
    renderForm();

    await userEvent.type(screen.getByLabelText("Nome"), " Lima");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("customer is incomplete");
  });
});
