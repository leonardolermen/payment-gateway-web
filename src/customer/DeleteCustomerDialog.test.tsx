import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import { aCustomer } from "../test/fixtures/customers";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { customerKeys } from "./customerApi";
import { DeleteCustomerDialog } from "./DeleteCustomerDialog";

const CUSTOMER = "http://localhost:8080/v1/customers/cus_00000001";

function renderDialog() {
  setAccessToken("gs_test");
  const onClose = vi.fn();
  const view = renderWithProviders(
    [
      {
        path: "/app/customers/:id",
        element: <DeleteCustomerDialog customer={aCustomer()} onClose={onClose} />,
      },
      { path: "/app/customers", element: <p>Lista de clientes</p> },
    ],
    { initialEntries: ["/app/customers/cus_00000001"], me: aMe({ role: "OWNER" }) },
  );
  return { ...view, onClose };
}

function confirmInput() {
  return screen.getByLabelText("Digite o nome do cliente para confirmar");
}

describe("DeleteCustomerDialog", () => {
  it("explainsThatItCannotBeUndone", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Excluir cliente?" });
    expect(dialog).toHaveTextContent(/não pode ser desfeita/);
    expect(dialog).toHaveTextContent(/LGPD/);
  });

  it("deleteNeedsTheExactNameAndShowsTheConflict", async () => {
    server.use(
      http.delete(CUSTOMER, () =>
        HttpResponse.json(
          {
            type: "urn:gateway:CUSTOMER_HAS_ACTIVE_SUBSCRIPTION",
            status: 409,
            detail: "customer cus_00000001 has active subscription sub_00000003",
          },
          { status: 409 },
        ),
      ),
    );
    const { router, onClose } = renderDialog();
    const confirm = screen.getByRole("button", { name: "Excluir" });

    expect(confirm).toBeDisabled();

    await userEvent.type(confirmInput(), "maria souza");
    expect(confirm).toBeDisabled();

    await userEvent.clear(confirmInput());
    await userEvent.type(confirmInput(), "Maria Souz");
    expect(confirm).toBeDisabled();

    await userEvent.clear(confirmInput());
    await userEvent.type(confirmInput(), "  Maria Souza ");
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "customer cus_00000001 has active subscription sub_00000003",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/app/customers/cus_00000001");
  });

  it("aDeletedCustomerLeavesTheCacheAndGoesBackToTheList", async () => {
    server.use(http.delete(CUSTOMER, () => new HttpResponse(null, { status: 204 })));
    const { router, queryClient } = renderDialog();
    queryClient.setQueryData(customerKeys.detail("cus_00000001"), aCustomer());
    queryClient.setQueryData(customerKeys.list({}), { pages: [[aCustomer()]], pageParams: [] });

    await userEvent.type(confirmInput(), "Maria Souza");
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(await screen.findByText("Lista de clientes")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/app/customers");
    expect(queryClient.getQueryData(customerKeys.detail("cus_00000001"))).toBeUndefined();
    await waitFor(() =>
      expect(queryClient.getQueryState(customerKeys.list({}))?.isInvalidated).toBe(true),
    );
  });

  it("backClosesWithoutARequest", async () => {
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(onClose).toHaveBeenCalled();
  });
});
