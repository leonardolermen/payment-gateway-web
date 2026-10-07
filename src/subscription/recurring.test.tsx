import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { NewOrderForm } from "../order/NewOrderForm";
import { InstallmentSettingsPage } from "../settings/InstallmentSettingsPage";
import { anOrder } from "../test/fixtures/orders";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { SubscriptionDetailPanel } from "./SubscriptionDetailPanel";
import type { Subscription } from "./types";

const API = "http://localhost:8080";

function aSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_1",
    status: "ACTIVE",
    customer_id: "cus_1",
    customer_name: "Ana Silva",
    plan_id: "plan_1",
    plan_name: "Café do mês",
    amount: 4990,
    interval: "MONTH",
    interval_count: 1,
    method: "CARD",
    card_id: "card_1",
    current_period: { start: "2026-10-01", end: "2026-10-31" },
    next_billing_at: "2026-11-01T03:00:00Z",
    cancel_at_period_end: false,
    latest_order: null,
    created_at: "2026-10-01T12:00:00Z",
    ...overrides,
  };
}

function renderForm() {
  storeApiKey("gk_test_abc");
  return renderWithProviders(
    [
      { path: "/app/orders", element: <NewOrderForm /> },
      { path: "/app/orders/:id", element: <div>cobrança</div> },
      { path: "/app/subscriptions/:id", element: <div>assinatura</div> },
    ],
    { initialEntries: ["/app/orders"] },
  );
}

async function chooseRecurringWithANewCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "Recorrente" }));
  await user.type(screen.getByLabelText("Valor"), "49,90");
  await user.type(screen.getByLabelText("Nome do plano"), "Café do mês");
  await user.click(screen.getByRole("radio", { name: "Novo" }));
  await user.type(screen.getByLabelText("Nome"), "Ana Silva");
  await user.type(screen.getByLabelText("Documento"), "52998224725");
}

describe("recurring charge", () => {
  it("createsCustomerPlanAndSubscriptionInOrderAndOpensTheFirstInvoice", async () => {
    const calls: { path: string; body: unknown; key: string | null }[] = [];
    const record = async (request: Request) => {
      calls.push({
        path: new URL(request.url).pathname,
        body: await request.json(),
        key: request.headers.get("Idempotency-Key"),
      });
    };
    server.use(
      http.get(`${API}/v1/plans`, () => HttpResponse.json([])),
      http.post(`${API}/v1/customers`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ id: "cus_9", name: "Ana Silva" }, { status: 201 });
      }),
      http.post(`${API}/v1/plans`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ id: "plan_9" }, { status: 201 });
      }),
      http.post(`${API}/v1/subscriptions`, async ({ request }) => {
        await record(request);
        return HttpResponse.json(
          aSubscription({
            status: "INCOMPLETE",
            first_invoice: { order_id: "ord_77", checkout_url: "http://pay/chk_1" },
          }),
          { status: 201 },
        );
      }),
    );
    const { router } = renderForm();
    const user = userEvent.setup();

    await chooseRecurringWithANewCustomer(user);
    await user.click(screen.getByRole("button", { name: "Criar assinatura" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/orders/ord_77"));
    expect(router.state.location.state).toEqual({ checkoutUrl: "http://pay/chk_1" });
    expect(calls.map((call) => call.path)).toEqual([
      "/v1/customers",
      "/v1/plans",
      "/v1/subscriptions",
    ]);
    expect(calls[1]?.body).toEqual({
      name: "Café do mês",
      amount: 4990,
      currency: "BRL",
      interval: "MONTH",
      interval_count: 1,
      trial_days: 0,
    });
    expect(calls[2]?.body).toEqual({ customer_id: "cus_9", plan_id: "plan_9", method: "CARD" });
    expect(new Set(calls.map((call) => call.key)).size).toBe(3);
  });

  it("anExistingDocumentBecomesTheSubscriptionsCustomerAndPixOpensTheSubscription", async () => {
    let subscriptionBody: unknown = null;
    server.use(
      http.get(`${API}/v1/plans`, () =>
        HttpResponse.json([
          {
            id: "plan_1",
            name: "Café do mês",
            amount: 4990,
            currency: "BRL",
            interval: "MONTH",
            interval_count: 1,
            trial_days: 0,
            active: true,
            created_at: "2026-10-01T12:00:00Z",
          },
        ]),
      ),
      http.post(`${API}/v1/customers`, () =>
        HttpResponse.json(
          { type: "urn:gateway:CUSTOMER_EXISTS", status: 409, customer_id: "cus_old" },
          { status: 409 },
        ),
      ),
      http.post(`${API}/v1/subscriptions`, async ({ request }) => {
        subscriptionBody = await request.json();
        return HttpResponse.json(aSubscription({ id: "sub_pix", method: "PIX" }), { status: 201 });
      }),
    );
    const { router } = renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", { name: "Recorrente" }));
    await user.selectOptions(await screen.findByLabelText("Plano"), "plan_1");
    expect(screen.queryByLabelText("Valor")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Pix" }));
    await user.click(screen.getByRole("radio", { name: "Novo" }));
    await user.type(screen.getByLabelText("Nome"), "Ana Silva");
    await user.type(screen.getByLabelText("Documento"), "52998224725");
    await user.click(screen.getByRole("button", { name: "Criar assinatura" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/subscriptions/sub_pix"));
    expect(subscriptionBody).toEqual({ customer_id: "cus_old", plan_id: "plan_1", method: "PIX" });
  });
});

describe("subscription detail", () => {
  function renderDetail(subscription: Subscription, invoices = [anOrder()]) {
    storeApiKey("gk_test_abc");
    server.use(
      http.get(`${API}/v1/subscriptions/sub_1`, () => HttpResponse.json(subscription)),
      http.get(`${API}/v1/subscriptions/sub_1/orders`, () => HttpResponse.json(invoices)),
    );
    return renderWithProviders(
      [{ path: "/app/subscriptions/:id", element: <SubscriptionDetailPanel /> }],
      { initialEntries: ["/app/subscriptions/sub_1"] },
    );
  }

  it("aPastDueSubscriptionPointsAtItsOpenInvoice", async () => {
    renderDetail(aSubscription({ status: "PAST_DUE" }), [
      anOrder({ id: "ord_3", status: "OPEN", invoice_number: 3, subscription_id: "sub_1" }),
      anOrder({ id: "ord_2", status: "PAID", invoice_number: 2, subscription_id: "sub_1" }),
    ]);

    expect(await screen.findByText("Pagamento em atraso")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir a cobrança" })).toHaveAttribute(
      "href",
      "/app/orders/ord_3",
    );
    expect(screen.getByRole("link", { name: "Fatura 2" })).toBeInTheDocument();
  });

  it("cancellingNowSendsAtPeriodEndFalse", async () => {
    let body: unknown = null;
    server.use(
      http.post(`${API}/v1/subscriptions/sub_1/cancel`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(aSubscription({ status: "CANCELED" }));
      }),
    );
    renderDetail(aSubscription());
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cancelar agora" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(body).toEqual({ at_period_end: false }));
  });
});

describe("installment settings", () => {
  it("sendsTheRateInBasisPoints", async () => {
    let body: unknown = null;
    storeApiKey("gk_test_abc");
    server.use(
      http.get(`${API}/v1/installment-settings`, () =>
        HttpResponse.json({ max_installments: 12, interest_free_up_to: 12, monthly_rate_bps: 0 }),
      ),
      http.put(`${API}/v1/installment-settings`, async ({ request }) => {
        const sent = (await request.json()) as Record<string, number>;
        body = sent;
        return HttpResponse.json(sent);
      }),
    );
    renderWithProviders([{ path: "/", element: <InstallmentSettingsPage /> }]);
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText("Máximo de parcelas"), "10");
    await user.selectOptions(screen.getByLabelText("Sem juros até"), "3");
    await user.clear(screen.getByLabelText("Juros ao mês (%)"));
    await user.type(screen.getByLabelText("Juros ao mês (%)"), "2,99");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(body).toEqual({ max_installments: 10, interest_free_up_to: 3, monthly_rate_bps: 299 }),
    );
    expect(await screen.findByText("Configuração salva.")).toBeInTheDocument();
  });
});
