import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import { server } from "../test/msw/server";
import { aMe } from "../test/me";
import { anOrder } from "../test/fixtures/orders";
import { renderWithProviders } from "../test/render";
import { OrdersList } from "./OrdersList";
import type { Role } from "../auth/types";
import type { Order } from "./types";

const ORDERS_URL = "http://localhost:8080/v1/orders";

function renderPage(onNewOrder = () => {}, role: Role = "OWNER") {
  setAccessToken("gs_test");
  return renderWithProviders(
    [
      { path: "/app/orders", element: <OrdersList onNewOrder={onNewOrder} /> },
      { path: "/app/orders/:id", element: <OrdersList onNewOrder={onNewOrder} /> },
    ],
    { initialEntries: ["/app/orders"], me: aMe({ role }) },
  );
}

describe("OrdersList", () => {
  it("rendersOrdersNewestFirstWithTheCustomerName", async () => {
    const orders = [
      anOrder({
        id: "ord_new",
        amount: 4990,
        status: "PAID",
        customer_id: "cus_1",
        customer_name: "Ana Silva",
      }),
      anOrder({ id: "ord_mid", amount: 1500, status: "OPEN", customer_id: "cus_2abcdefgh" }),
      anOrder({ id: "ord_old", amount: 1000, status: "OPEN" }),
    ];
    server.use(http.get(ORDERS_URL, () => HttpResponse.json(orders)));

    renderPage();

    expect(await screen.findByText("R$ 49,90")).toBeInTheDocument();
    expect(screen.getByText("Paga")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Ana Silva");
    // A deleted customer: the order keeps the id, the name is gone.
    expect(rows[2]).toHaveTextContent("cus_2abc…");
    expect(rows[3]).toHaveTextContent("pagador avulso");
  });

  it("aClickOnARowOpensTheOrderAndMarksIt", async () => {
    server.use(http.get(ORDERS_URL, () => HttpResponse.json([anOrder({ id: "ord_a" })])));
    const { router } = renderPage();

    await userEvent.click(await screen.findByText("R$ 49,90"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/orders/ord_a"));
    expect(screen.getAllByRole("row")[1]).toHaveAttribute("data-selected", "true");
  });

  it("newOrderAsksTheWorkspaceForTheForm", async () => {
    const onNewOrder = vi.fn();
    server.use(http.get(ORDERS_URL, () => HttpResponse.json([])));
    renderPage(onNewOrder);

    await userEvent.click(screen.getByRole("button", { name: /Nova cobrança/ }));

    expect(onNewOrder).toHaveBeenCalledOnce();
  });

  it("loadMoreRequestsTheNextCursor", async () => {
    const page: Order[] = Array.from({ length: 20 }, (_, index) =>
      anOrder({ id: `ord_${String(index).padStart(2, "0")}` }),
    );
    const cursors: (string | null)[] = [];
    server.use(
      http.get(ORDERS_URL, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        return HttpResponse.json(cursor ? [] : page);
      }),
    );

    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));

    await waitFor(() => expect(cursors).toEqual([null, "ord_19"]));
  });

  it("statusFilterIsSentToTheApi", async () => {
    const statuses: (string | null)[] = [];
    server.use(
      http.get(ORDERS_URL, ({ request }) => {
        statuses.push(new URL(request.url).searchParams.get("status"));
        return HttpResponse.json([]);
      }),
    );

    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText("Status"), "Pagas");

    await waitFor(() => expect(statuses).toContain("PAID"));
  });
});

describe("OrdersList matches the approved mockup", () => {
  it("putsTitleFilterAndCreateOnOneRowAndTheTableInAnUnpaddedCard", async () => {
    server.use(
      http.get(ORDERS_URL, () =>
        HttpResponse.json([
          anOrder({ id: "ord_a", status: "PAID" }),
          anOrder({ id: "ord_b", status: "OPEN" }),
          anOrder({ id: "ord_c", status: "EXPIRED" }),
        ]),
      ),
    );

    renderPage();

    const title = screen.getByRole("heading", { name: "Cobranças" });
    expect(title).toHaveClass("font-display", "text-[22px]");
    const titleRow = title.parentElement as HTMLElement;
    expect(titleRow).toContainElement(screen.getByRole("button", { name: /Nova cobrança/ }));
    expect(titleRow).toContainElement(screen.getByLabelText("Status"));

    expect(await screen.findByText("Paga")).toHaveClass("bg-ok-bg");
    const table = screen.getByRole("table");
    expect(table.closest(".rounded-card")).toHaveClass("p-0");
    expect(screen.getAllByRole("columnheader")[0]).toHaveClass("text-[10px]", "uppercase");

    expect(screen.getByText("Aberta")).toHaveClass("bg-warn-bg");
    expect(screen.getByText("Expirada")).toHaveClass("bg-neutral-bg");
    expect(screen.getAllByText("R$ 49,90")[0]).toHaveClass("font-display", "font-bold");
  });

  it("hidesTheNewOrderButtonFromReadonly", async () => {
    server.use(http.get(ORDERS_URL, () => HttpResponse.json([anOrder()])));
    renderPage(() => {}, "READONLY");

    await screen.findByText("R$ 49,90");

    expect(screen.queryByRole("button", { name: /Nova cobrança/ })).not.toBeInTheDocument();
  });

  it("showsTheNewOrderButtonToFinance", async () => {
    server.use(http.get(ORDERS_URL, () => HttpResponse.json([anOrder()])));
    renderPage(() => {}, "FINANCE");

    expect(await screen.findByRole("button", { name: /Nova cobrança/ })).toBeInTheDocument();
  });
});
