import { act, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { anOrder, aPayment } from "../test/fixtures/orders";
import { renderWithProviders } from "../test/render";
import { OrderDetailPage } from "./OrderDetailPage";

const BASE = "http://localhost:8080/v1/orders/ord_00000001";

function renderPage() {
  storeApiKey("gk_test_abc");
  return renderWithProviders([{ path: "/app/orders/:id", element: <OrderDetailPage /> }], {
    initialEntries: ["/app/orders/ord_00000001"],
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OrderDetailPage", () => {
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
});
