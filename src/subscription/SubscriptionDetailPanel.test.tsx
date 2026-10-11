import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import { aSavedCard } from "../test/fixtures/customers";
import { aPlan } from "../test/fixtures/plans";
import { aSubscription } from "../test/fixtures/subscriptions";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { SubscriptionDetailPanel } from "./SubscriptionDetailPanel";
import type { Subscription } from "./types";

const API = "http://localhost:8080/v1";
const SUBSCRIPTION = `${API}/subscriptions/sub_00000001`;

type Counters = { subscription: number; invoices: number; cards: number };

function serve(subscription: Subscription) {
  const counters: Counters = { subscription: 0, invoices: 0, cards: 0 };
  server.use(
    http.get(SUBSCRIPTION, () => {
      counters.subscription += 1;
      return HttpResponse.json(subscription);
    }),
    http.get(`${SUBSCRIPTION}/orders`, () => {
      counters.invoices += 1;
      return HttpResponse.json([]);
    }),
    http.get(`${API}/plans/:id`, () => HttpResponse.json(aPlan({ name: "Mensal Pro" }))),
    http.get(`${API}/cards/:id`, () => {
      counters.cards += 1;
      return HttpResponse.json(aSavedCard());
    }),
  );
  return counters;
}

function renderPanel(role: Role = "FINANCE", path = "/app/subscriptions/sub_00000001") {
  setAccessToken("gs_test");
  return renderWithProviders(
    [
      { path: "/app/subscriptions/:id", element: <SubscriptionDetailPanel /> },
      { path: "/app/customers/:id", element: <div>cliente</div> },
      { path: "/app/orders/:id", element: <div>pedido</div> },
    ],
    { initialEntries: [path], me: aMe({ role }) },
  );
}

function serverError(status: number) {
  return HttpResponse.json({ type: "urn:gateway:INTERNAL", status }, { status });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SubscriptionDetailPanel", () => {
  it("showsTheHeader", async () => {
    serve(aSubscription({ method: "CARD", card_id: "card_00000001" }));
    renderPanel();

    const header = await screen.findByRole("region", { name: "Assinatura sub_00000001" });
    expect(await within(header).findByText("Mensal Pro")).toBeInTheDocument();
    expect(within(header).getByText("Ativa")).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "Maria Souza" })).toHaveAttribute(
      "href",
      "/app/customers/cus_00000001",
    );
    expect(within(header).getByText("Cartão")).toBeInTheDocument();
    expect(await within(header).findByText("Visa final 4242")).toBeInTheDocument();
    expect(within(header).getByText("06/10/2026 – 06/11/2026")).toBeInTheDocument();
    expect(within(header).getByText("06/11/2026, 09:00")).toBeInTheDocument();
    expect(within(header).queryByText("Cancela no fim do período")).not.toBeInTheDocument();
  });

  it("asksForNoCardWithoutACardId", async () => {
    const counters = serve(aSubscription({ method: "PIX", card_id: null }));
    renderPanel();

    expect(await screen.findByText("Pix")).toBeInTheDocument();
    expect(screen.queryByText(/final/)).not.toBeInTheDocument();
    expect(counters.cards).toBe(0);
  });

  it("showsTheDunningOnlyWhenThereIsSome", async () => {
    serve(
      aSubscription({
        status: "PAST_DUE",
        dunning: [
          {
            attempt: 1,
            scheduled_at: "2026-10-07T12:00:00Z",
            ran_at: "2026-10-07T12:00:05Z",
            outcome: "DECLINED",
          },
          { attempt: 2, scheduled_at: "2026-10-10T12:00:00Z", ran_at: null, outcome: null },
        ],
      }),
    );
    renderPanel();

    const dunning = await screen.findByRole("region", { name: "Recobrança" });
    const rows = within(dunning).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1] as HTMLElement).getByText("Recusada")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getAllByText("07/10/2026, 09:00")).toHaveLength(2);
    expect(within(rows[2] as HTMLElement).getAllByText("—")).toHaveLength(2);
  });

  it("hidesTheDunningWithoutAttempts", async () => {
    serve(aSubscription({ dunning: [] }));
    renderPanel();

    await screen.findByRole("region", { name: "Assinatura sub_00000001" });
    expect(screen.queryByRole("region", { name: "Recobrança" })).not.toBeInTheDocument();
  });

  it("offersCancelAndChangeMethodToFinanceOnAnActiveSubscription", async () => {
    serve(aSubscription());
    renderPanel("FINANCE");

    expect(await screen.findByRole("button", { name: "Cancelar assinatura" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar método" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    expect(screen.getByRole("dialog", { name: "Cancelar assinatura?" })).toBeInTheDocument();
  });

  it("offersNoActionToReadonly", async () => {
    serve(aSubscription());
    renderPanel("READONLY");

    await screen.findByRole("region", { name: "Assinatura sub_00000001" });
    expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trocar método" })).not.toBeInTheDocument();
  });

  it.each(["CANCELED", "ENDED", "INCOMPLETE_EXPIRED"] as const)(
    "offersNoActionOnA%sSubscription",
    async (status) => {
      serve(aSubscription({ status }));
      renderPanel("OWNER");

      await screen.findByRole("region", { name: "Assinatura sub_00000001" });
      expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Trocar método" })).not.toBeInTheDocument();
    },
  );

  // INCOMPLETE is not billable at the gateway: cancel and change both answer 409 there.
  it("offersNoActionOnAnIncompleteSubscription", async () => {
    serve(aSubscription({ status: "INCOMPLETE", method: "CARD", card_id: null }));
    renderPanel("OWNER");

    await screen.findByRole("region", { name: "Assinatura sub_00000001" });
    expect(screen.queryByRole("button", { name: /Cancelar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trocar método" })).not.toBeInTheDocument();
  });

  it.each(["ACTIVE", "PAST_DUE"] as const)(
    "aCancelAlreadyScheduledOnA%sSubscriptionStillOffersCancelNow",
    async (status) => {
      serve(aSubscription({ status, cancel_at_period_end: true }));
      renderPanel("OWNER");

      expect(await screen.findByText("Cancela no fim do período")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Trocar método" })).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Cancelar agora" }));

      const dialog = screen.getByRole("dialog", { name: "Cancelar assinatura?" });
      expect(
        within(dialog).queryByRole("radio", { name: "No fim do período" }),
      ).not.toBeInTheDocument();
      expect(within(dialog).getByRole("radio", { name: "Agora" })).toBeChecked();
      expect(dialog).toHaveTextContent("A fatura em aberto também é cancelada no banco.");
    },
  );

  it("pollsEveryFiveSecondsWhileThePayerOwes", async () => {
    const counters = serve(aSubscription({ status: "PAST_DUE" }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPanel();
    await screen.findByText("Em atraso");
    const subscriptionCalls = counters.subscription;
    const invoiceCalls = counters.invoices;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });

    expect(counters.subscription).toBeGreaterThan(subscriptionCalls);
    expect(counters.invoices).toBeGreaterThan(invoiceCalls);
  });

  it("pollsEveryTenSecondsOtherwise", async () => {
    const counters = serve(aSubscription({ status: "ACTIVE" }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPanel();
    await screen.findByText("Ativa");
    const subscriptionCalls = counters.subscription;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100);
    });
    expect(counters.subscription).toBe(subscriptionCalls);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(counters.subscription).toBeGreaterThan(subscriptionCalls);
  });

  it("startsAfreshOnAnotherSubscription", async () => {
    serve(aSubscription());
    server.use(
      http.get(`${API}/subscriptions/sub_00000002`, () =>
        HttpResponse.json(aSubscription({ id: "sub_00000002", status: "PAST_DUE" })),
      ),
      http.get(`${API}/subscriptions/sub_00000002/orders`, () => HttpResponse.json([])),
    );
    const { router } = renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "Cancelar assinatura" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(() => router.navigate("/app/subscriptions/sub_00000002"));

    expect(
      await screen.findByRole("region", { name: "Assinatura sub_00000002" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saysWhenTheSubscriptionCannotBeRead", async () => {
    server.use(
      http.get(SUBSCRIPTION, () => serverError(500)),
      http.get(`${SUBSCRIPTION}/orders`, () => HttpResponse.json([])),
    );
    renderPanel();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a assinatura.",
    );
  });

  // A poll that fails must not unmount what the user is doing with the data already on screen.
  it("aFailedRefetchKeepsTheDataAndTheOpenDialog", async () => {
    let calls = 0;
    server.use(
      http.get(SUBSCRIPTION, () => {
        calls += 1;
        return calls === 1 ? HttpResponse.json(aSubscription()) : serverError(503);
      }),
      http.get(`${SUBSCRIPTION}/orders`, () => HttpResponse.json([])),
      http.get(`${API}/plans/:id`, () => HttpResponse.json(aPlan())),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "Cancelar assinatura" }));
    expect(screen.getByRole("dialog", { name: "Cancelar assinatura?" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_100);
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Não foi possível atualizar. Mostrando os últimos dados.",
    );
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("dialog", { name: "Cancelar assinatura?" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Assinatura sub_00000001" })).toBeInTheDocument();
  });
});
