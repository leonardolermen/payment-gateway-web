import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { anOrder } from "../test/fixtures/orders";
import { renderWithProviders } from "../test/render";
import { OrdersPage } from "./OrdersPage";
import type { Order } from "./types";

const ORDERS_URL = "http://localhost:8080/v1/orders";

function renderPage() {
  storeApiKey("gk_test_abc");
  return renderWithProviders([{ path: "/app/orders", element: <OrdersPage /> }], {
    initialEntries: ["/app/orders"],
  });
}

describe("OrdersPage", () => {
  it("rendersOrdersNewestFirstWithFormattedMoney", async () => {
    const orders = [
      anOrder({ id: "ord_new", amount: 4990, status: "PAID", description: "Mais nova" }),
      anOrder({ id: "ord_old", amount: 1000, status: "OPEN", description: "Mais antiga" }),
    ];
    server.use(http.get(ORDERS_URL, () => HttpResponse.json(orders)));

    renderPage();

    expect(await screen.findByText("R$ 49,90")).toBeInTheDocument();
    expect(screen.getByText("Paga")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Mais nova");
    expect(rows[2]).toHaveTextContent("Mais antiga");
    expect(screen.getAllByText("pagador avulso")).toHaveLength(2);
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

describe("OrdersPage matches the approved mockup", () => {
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
    expect(titleRow).toContainElement(screen.getByRole("link", { name: /Nova cobrança/ }));
    expect(titleRow).toContainElement(screen.getByLabelText("Status"));

    expect(await screen.findByText("Paga")).toHaveClass("bg-ok-bg");
    const table = screen.getByRole("table");
    expect(table.closest(".rounded-card")).toHaveClass("p-0");
    expect(screen.getAllByRole("columnheader")[0]).toHaveClass("text-[10px]", "uppercase");

    expect(screen.getByText("Aberta")).toHaveClass("bg-warn-bg");
    expect(screen.getByText("Expirada")).toHaveClass("bg-neutral-bg");
    expect(screen.getAllByText("R$ 49,90")[0]).toHaveClass("font-display", "font-bold");
  });
});
