import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import type { Order } from "../order/types";
import { aSavedCard } from "../test/fixtures/customers";
import { anOrder } from "../test/fixtures/orders";
import { aPlan } from "../test/fixtures/plans";
import { aSubscription } from "../test/fixtures/subscriptions";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { SubscriptionDetailPanel } from "./SubscriptionDetailPanel";
import type { Subscription } from "./types";

const API = "http://localhost:8080/v1";
const SUBSCRIPTION = `${API}/subscriptions/sub_00000001`;

function anInvoice(overrides: Partial<Order> = {}): Order {
  return anOrder({
    id: "ord_invoice01",
    status: "PAID",
    subscription_id: "sub_00000001",
    invoice_number: 1,
    period: { start: "2026-09-06", end: "2026-10-06" },
    ...overrides,
  });
}

type Counters = { subscription: number; invoices: number; cards: number };

function serve(subscription: Subscription, invoices: Order[] = []) {
  const counters: Counters = { subscription: 0, invoices: 0, cards: 0 };
  server.use(
    http.get(SUBSCRIPTION, () => {
      counters.subscription += 1;
      return HttpResponse.json(subscription);
    }),
    http.get(`${SUBSCRIPTION}/orders`, () => {
      counters.invoices += 1;
      return HttpResponse.json(invoices);
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

  it("listsTheInvoicesWithLinksToTheOrders", async () => {
    serve(aSubscription(), [
      anInvoice({
        id: "ord_invoice02",
        invoice_number: 2,
        status: "OPEN",
        amount: 2990,
        period: { start: "2026-10-06", end: "2026-11-06" },
      }),
      anInvoice(),
    ]);
    renderPanel("READONLY");

    const invoices = await screen.findByRole("region", { name: "Faturas" });
    const rows = await within(invoices).findAllByRole("row");
    // The header row, then newest first as the gateway sends them.
    expect(rows).toHaveLength(3);
    const newest = rows[1] as HTMLElement;
    expect(within(newest).getByRole("link", { name: "#2" })).toHaveAttribute(
      "href",
      "/app/orders/ord_invoice02",
    );
    expect(within(newest).getByText("06/10/2026 – 06/11/2026")).toBeInTheDocument();
    expect(within(newest).getByText("R$ 29,90")).toBeInTheDocument();
    expect(within(newest).getByText("Aberta")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText("Paga")).toBeInTheDocument();
  });

  it("copiesARotatedLinkOfTheOpenInvoice", async () => {
    const user = userEvent.setup();
    // After setup(): user-event installs its own clipboard stub and would override an earlier one.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    serve(aSubscription(), [anInvoice({ status: "OPEN" }), anInvoice({ id: "ord_old" })]);
    const keys: (string | null)[] = [];
    server.use(
      http.post(`${API}/orders/ord_invoice01/checkout-token/rotate`, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.json(
          anInvoice({ status: "OPEN", checkout_url: "https://pay.example/c/fresh" }),
        );
      }),
    );
    const { queryClient } = renderPanel();

    const invoices = await screen.findByRole("region", { name: "Faturas" });
    // Only the open invoice has a payable link.
    expect(await within(invoices).findAllByRole("button", { name: "Copiar link" })).toHaveLength(1);
    await user.click(within(invoices).getByRole("button", { name: "Copiar link" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://pay.example/c/fresh"));
    expect(await within(invoices).findByText(/Link novo copiado/)).toBeInTheDocument();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBeTruthy();

    // A rotated link is handed out once: no query or mutation in the caches keeps it.
    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const mutations = queryClient.getMutationCache().getAll();
      const cached = JSON.stringify([
        queries.map((query) => query.state.data),
        mutations.map((mutation) => mutation.state.data),
      ]);
      expect(cached).not.toContain("pay.example/c/fresh");
    });
  });

  it("offersNoInvoiceActionToReadonly", async () => {
    serve(aSubscription({ method: "CARD", card_id: "card_00000001" }), [
      anInvoice({ status: "OPEN" }),
    ]);
    renderPanel("READONLY");

    const invoices = await screen.findByRole("region", { name: "Faturas" });
    await within(invoices).findByText("Aberta");
    expect(within(invoices).queryByRole("button", { name: "Copiar link" })).not.toBeInTheDocument();
    expect(
      within(invoices).queryByRole("button", { name: "Cobrar de novo" }),
    ).not.toBeInTheDocument();
  });

  it("chargesAgainOnlyACardSubscriptionWithASavedCard", async () => {
    serve(aSubscription({ method: "PIX" }), [anInvoice({ status: "OPEN" })]);
    renderPanel();

    const invoices = await screen.findByRole("region", { name: "Faturas" });
    await within(invoices).findByText("Aberta");
    expect(
      within(invoices).queryByRole("button", { name: "Cobrar de novo" }),
    ).not.toBeInTheDocument();
  });

  it("chargesAgainWithTheSavedCardUnderOneKeyUntilAClearAnswer", async () => {
    serve(aSubscription({ method: "CARD", card_id: "card_00000001", status: "PAST_DUE" }), [
      anInvoice({ status: "OPEN" }),
    ]);
    const sent: { body: unknown; key: string | null }[] = [];
    server.use(
      http.post(`${API}/orders/ord_invoice01/payments`, async ({ request }) => {
        sent.push({ body: await request.json(), key: request.headers.get("Idempotency-Key") });
        return sent.length === 1
          ? serverError(503)
          : HttpResponse.json({ id: "pay_1", status: "PENDING" }, { status: 201 });
      }),
    );
    renderPanel();

    const invoices = await screen.findByRole("region", { name: "Faturas" });
    await userEvent.click(await within(invoices).findByRole("button", { name: "Cobrar de novo" }));

    const dialog = screen.getByRole("dialog", { name: "Cobrar de novo?" });
    expect(await within(dialog).findByText("Visa final 4242")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("CVV"), "123");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));

    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[0]?.body).toEqual({ method: "CARD", card_id: "card_00000001", cvv: "123" });
    expect(sent[1]?.key).toBe(sent[0]?.key);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Cobrar de novo?" })).not.toBeInTheDocument(),
    );
  });

  it("chargingAgainNeedsTheCvvAndAFreshKeyAfterARefusal", async () => {
    serve(aSubscription({ method: "CARD", card_id: "card_00000001" }), [
      anInvoice({ status: "OPEN" }),
    ]);
    const keys: (string | null)[] = [];
    server.use(
      http.post(`${API}/orders/ord_invoice01/payments`, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.json(
          { type: "urn:gateway:INVALID_REQUEST", status: 400, detail: "cvv must be 3 or 4 digits" },
          { status: 400 },
        );
      }),
    );
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "Cobrar de novo" }));
    const dialog = screen.getByRole("dialog", { name: "Cobrar de novo?" });
    expect(within(dialog).getByRole("button", { name: "Cobrar" })).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText("CVV"), "123");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));

    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).not.toBe(keys[0]);
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

  it("anIncompleteSubscriptionMayBeCanceledButNotChanged", async () => {
    serve(aSubscription({ status: "INCOMPLETE", method: "CARD", card_id: null }));
    renderPanel("OWNER");

    expect(await screen.findByRole("button", { name: "Cancelar assinatura" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trocar método" })).not.toBeInTheDocument();
  });

  it("saysItCancelsAtTheEndOfThePeriodInsteadOfOfferingCancel", async () => {
    serve(aSubscription({ cancel_at_period_end: true }));
    renderPanel("OWNER");

    expect(await screen.findByText("Cancela no fim do período")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar método" })).toBeInTheDocument();
  });

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
});
