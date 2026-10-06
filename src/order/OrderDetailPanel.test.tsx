import { act, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { anOrder, aPayment } from "../test/fixtures/orders";
import { renderWithProviders } from "../test/render";
import { OrderDetailPanel } from "./OrderDetailPanel";

const BASE = "http://localhost:8080/v1/orders/ord_00000001";

function renderPage() {
  storeApiKey("gk_test_abc");
  return renderWithProviders([{ path: "/app/orders/:id", element: <OrderDetailPanel /> }], {
    initialEntries: ["/app/orders/ord_00000001"],
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OrderDetailPanel", () => {
  it("showsTheOrderAndItsAttempts", async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json(anOrder({ reference: "PED-9" }))),
      http.get(`${BASE}/payments`, () =>
        HttpResponse.json([aPayment({ status: "COMPLETED", method: "CARD" })]),
      ),
    );

    renderPage();

    // Once in the summary and once in the attempt row.
    expect(await screen.findAllByText("R$ 49,90")).toHaveLength(2);
    expect(screen.getByText("Plano mensal")).toBeInTheDocument();
    expect(screen.getByText("PED-9")).toBeInTheDocument();
    expect(await screen.findByText("Concluído")).toBeInTheDocument();
    expect(screen.getByText("Cartão")).toBeInTheDocument();
  });

  it("pollsWhileAnAttemptIsPending", async () => {
    let attemptCalls = 0;
    server.use(
      http.get(BASE, () => HttpResponse.json(anOrder())),
      http.get(`${BASE}/payments`, () => {
        attemptCalls += 1;
        return HttpResponse.json([aPayment({ status: "PENDING" })]);
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    expect(await screen.findByText("Pendente")).toBeInTheDocument();
    expect(attemptCalls).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });

    expect(attemptCalls).toBeGreaterThanOrEqual(2);
  });

  it("theOrderTurnsPaidAfterTheAttemptSettlesWithoutAReload", async () => {
    let orderCalls = 0;
    let attemptCalls = 0;
    server.use(
      http.get(BASE, () => {
        orderCalls += 1;
        // The relay lags: the refetch that coincides with the settled attempt still sees OPEN.
        return HttpResponse.json(anOrder({ status: orderCalls >= 3 ? "PAID" : "OPEN" }));
      }),
      http.get(`${BASE}/payments`, () => {
        attemptCalls += 1;
        return HttpResponse.json([
          aPayment({ status: attemptCalls >= 2 ? "COMPLETED" : "PENDING" }),
        ]);
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    expect(await screen.findByText("Aberta")).toBeInTheDocument();
    expect(screen.getByText("Link de pagamento")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });

    expect(await screen.findByText("Paga")).toBeInTheDocument();
    expect(screen.queryByText("Link de pagamento")).not.toBeInTheDocument();
  });
});

describe("OrderDetailPanel matches the approved mockup", () => {
  it("stacksTheOrderCardAboveTheAttemptsCard", async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json(anOrder())),
      http.get(`${BASE}/payments`, () => HttpResponse.json([aPayment({ status: "PENDING" })])),
    );

    renderPage();

    const [amount] = await screen.findAllByText("R$ 49,90");
    expect(amount).toHaveClass("font-display", "text-[22px]");
    expect(amount?.parentElement).toContainElement(screen.getByText("Aberta"));

    // The workspace's right column: order card first, attempts card under it.
    const orderCard = amount?.closest(".rounded-card");
    const attemptsCard = screen
      .getByRole("heading", { name: "Tentativas" })
      .closest(".rounded-card");
    expect(orderCard?.nextElementSibling).toBe(attemptsCard);

    expect(screen.getByText("Cliente").closest("div")).toHaveClass("border-dashed");
    expect(screen.getByRole("button", { name: "Cancelar cobrança" })).toHaveClass("text-danger");
    expect(screen.getByRole("button", { name: "Gerar novo link" }).parentElement).toContainElement(
      screen.getByRole("button", { name: "Cancelar cobrança" }),
    );

    expect(screen.getByRole("heading", { name: "Tentativas" })).toBeInTheDocument();
    expect(await screen.findByText("Pendente")).toHaveClass("bg-warn-bg");
  });
});
