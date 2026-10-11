import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import { aMe } from "../test/me";
import { anOrder } from "../test/fixtures/orders";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { NoOrderSelected, OrdersWorkspace } from "./OrdersWorkspace";

const ORDERS = "http://localhost:8080/v1/orders";

function renderWorkspace(path = "/app/orders", role: Role = "OWNER") {
  setAccessToken("gs_test");
  return renderWithProviders(
    [
      {
        path: "/app/orders",
        element: <OrdersWorkspace />,
        children: [
          { index: true, element: <NoOrderSelected /> },
          { path: ":id", element: <OrderDetailPanel /> },
        ],
      },
    ],
    { initialEntries: [path], me: aMe({ role }) },
  );
}

describe("OrdersWorkspace", () => {
  it("showsTheListTheFormAndAHintBeforeAnOrderIsChosen", async () => {
    server.use(http.get(ORDERS, () => HttpResponse.json([anOrder()])));

    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "Cobranças" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nova cobrança" })).toBeInTheDocument();
    expect(screen.getByText(/Escolha uma cobrança na lista/)).toBeInTheDocument();
  });

  it("aCreatedOrderOpensOnTheRightWithItsLinkAndTheFormStartsOver", async () => {
    const created = anOrder({
      id: "ord_00000007",
      customer_id: "cus_1",
      customer_name: "Ana Lima",
      checkout_url: "http://localhost:5173/pay/chk_abc",
    });
    const keys: (string | null)[] = [];
    server.use(
      http.get(ORDERS, () => HttpResponse.json([])),
      http.post(ORDERS, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.json(created, { status: 201 });
      }),
      http.get(`${ORDERS}/ord_00000007`, () =>
        HttpResponse.json({ ...created, checkout_url: null }),
      ),
      http.get(`${ORDERS}/ord_00000007/payments`, () => HttpResponse.json([])),
    );
    const { router } = renderWorkspace();

    await userEvent.type(screen.getByLabelText("Valor"), "49,90");
    await userEvent.click(screen.getByRole("radio", { name: "Novo" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Ana Lima");
    await userEvent.type(screen.getByLabelText("Documento"), "12345678909");
    await userEvent.click(screen.getByRole("button", { name: "Criar cobrança" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/orders/ord_00000007"));
    // GET never returns the link; the one from the create is carried over, once.
    expect(await screen.findByText("http://localhost:5173/pay/chk_abc")).toBeInTheDocument();
    expect(screen.getByText("Ana Lima", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByLabelText("Valor")).toHaveValue("");

    await userEvent.type(screen.getByLabelText("Valor"), "10,00");
    await userEvent.click(screen.getByRole("radio", { name: "Novo" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Ana Lima");
    await userEvent.type(screen.getByLabelText("Documento"), "12345678909");
    await userEvent.click(screen.getByRole("button", { name: "Criar cobrança" }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("switchingOrdersDropsThePreviousLink", async () => {
    const first = anOrder({ id: "ord_a", checkout_url: "http://localhost:5173/pay/chk_first" });
    server.use(
      http.get(ORDERS, () => HttpResponse.json([first, anOrder({ id: "ord_b" })])),
      http.get(`${ORDERS}/:id`, ({ params }) =>
        HttpResponse.json(anOrder({ id: String(params.id) })),
      ),
      http.get(`${ORDERS}/:id/payments`, () => HttpResponse.json([])),
    );
    const { router } = renderWorkspace();
    await router.navigate("/app/orders/ord_a", { state: { checkoutUrl: first.checkout_url } });
    expect(await screen.findByText("http://localhost:5173/pay/chk_first")).toBeInTheDocument();

    await router.navigate("/app/orders/ord_b");

    await waitFor(() =>
      expect(screen.queryByText("http://localhost:5173/pay/chk_first")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/O link só é exibido uma vez/)).toBeInTheDocument();
  });

  it("readonlySeesTheListAndNoNewOrderForm", async () => {
    server.use(http.get(ORDERS, () => HttpResponse.json([anOrder()])));

    renderWorkspace("/app/orders", "READONLY");

    expect(await screen.findByRole("heading", { name: "Cobranças" })).toBeInTheDocument();
    await screen.findByText("R$ 49,90");
    expect(screen.queryByRole("heading", { name: "Nova cobrança" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Valor")).not.toBeInTheDocument();
  });
});
