import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { anOrder, aPayment } from "../test/fixtures/orders";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { OrderActions } from "./OrderActions";
import type { Order, Payment } from "./types";

const API = "http://localhost:8080/v1";

function renderActions(order: Order, attempts: Payment[] = []) {
  storeApiKey("gk_test_abc");
  return renderWithProviders([
    { path: "/", element: <OrderActions order={order} attempts={attempts} /> },
  ]);
}

const paid = () => aPayment({ status: "COMPLETED", paid_amount: 4990, refunded_amount: 0 });

describe("OrderActions", () => {
  it("asksForConfirmationThenCancels", async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/orders/ord_00000001/cancel`, () => {
        calls += 1;
        return HttpResponse.json(anOrder({ status: "CANCELED" }));
      }),
    );
    renderActions(anOrder());

    await userEvent.click(screen.getByRole("button", { name: "Cancelar cobrança" }));
    expect(calls).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(calls).toBe(1));
  });

  it("showsAlreadyPaidOnA409", async () => {
    server.use(
      http.post(`${API}/orders/ord_00000001/cancel`, () =>
        HttpResponse.json({ type: "urn:gateway:ALREADY_PAID", status: 409 }, { status: 409 }),
      ),
    );
    renderActions(anOrder());

    await userEvent.click(screen.getByRole("button", { name: "Cancelar cobrança" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Esta cobrança já foi paga.")).toBeInTheDocument();
  });

  it("sendsAPartialRefundInCents", async () => {
    let body: unknown = null;
    server.use(
      http.post(`${API}/payments/pay_00000001/refunds`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "ref_1", payment_id: "pay_00000001" }, { status: 202 });
      }),
    );
    renderActions(anOrder({ status: "PAID" }), [paid()]);

    await userEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    await userEvent.click(screen.getByRole("radio", { name: "Parcial" }));
    await userEvent.type(screen.getByLabelText("Valor"), "10,00");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));

    await waitFor(() => expect(body).toEqual({ amount: 1000 }));
  });

  it("refusesAnAmountOverThePaidOneBeforeAnyRequest", async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/payments/pay_00000001/refunds`, () => {
        calls += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderActions(anOrder({ status: "PAID" }), [paid()]);

    await userEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    await userEvent.click(screen.getByRole("radio", { name: "Parcial" }));
    await userEvent.type(screen.getByLabelText("Valor"), "50,00");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("R$ 49,90");
    expect(calls).toBe(0);
  });

  it("sendsNoAmountForAFullRefund", async () => {
    let body: unknown = "unset";
    server.use(
      http.post(`${API}/payments/pay_00000001/refunds`, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json({ id: "ref_1" }, { status: 201 });
      }),
    );
    renderActions(anOrder({ status: "PAID" }), [paid()]);

    await userEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));

    await waitFor(() => expect(body).not.toBe("unset"));
    expect(body === "" || body === "{}").toBe(true);
  });
});

describe("OrderActions after a refund", () => {
  it("aSecondRefundIsBlockedUntilTheFirstIsReflected", async () => {
    let refunds = 0;
    server.use(
      http.get(`${API}/orders/ord_00000001/payments`, () => HttpResponse.json([paid()])),
      http.post(`${API}/payments/pay_00000001/refunds`, () => {
        refunds += 1;
        return HttpResponse.json({ id: "ref_1" }, { status: 202 });
      }),
    );
    renderActions(anOrder({ status: "PAID" }), [paid()]);

    await userEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));

    expect(await screen.findByText("Reembolso em processamento")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reembolsar" })).not.toBeInTheDocument();
    expect(refunds).toBe(1);
  });
});

describe("RefundDialog amount", () => {
  it("refusesZeroAndClearsTheErrorWhenSwitchingToTotal", async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/payments/pay_00000001/refunds`, () => {
        calls += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderActions(anOrder({ status: "PAID" }), [paid()]);

    await userEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    await userEvent.click(screen.getByRole("radio", { name: "Parcial" }));
    await userEvent.type(screen.getByLabelText("Valor"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /Total/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });
});

describe("OrderActions idempotency keys", () => {
  it("aRetryAfterANetworkErrorReusesTheRefundKey", async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post(`${API}/payments/pay_00000001/refunds`, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return keys.length === 1 ? HttpResponse.error() : HttpResponse.json({ id: "ref_1" }, { status: 201 });
      }),
    );
    renderActions(anOrder({ status: "PAID" }), [paid()]);

    await userEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));

    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it("aChangedAmountGetsANewKey", async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post(`${API}/payments/pay_00000001/refunds`, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.error();
      }),
    );
    renderActions(anOrder({ status: "PAID" }), [paid()]);

    await userEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("radio", { name: "Parcial" }));
    await userEvent.type(screen.getByLabelText("Valor"), "10,00");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));

    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("aReopenedDialogGetsANewKey", async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post(`${API}/payments/pay_00000001/refunds`, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.error();
      }),
    );
    renderActions(anOrder({ status: "PAID" }), [paid()]);

    await userEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await userEvent.click(screen.getByRole("button", { name: "Reembolsar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reembolso" }));

    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).not.toBe(keys[0]);
  });
});
