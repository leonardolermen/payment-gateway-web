import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { aCheckout, aCheckoutPayment, CHECKOUT_URL } from "../test/fixtures/checkout";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { PayPage } from "./PayPage";
import type { Checkout } from "./types";

vi.mock("qrcode", () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

function renderCheckout(checkout: Partial<Checkout> = {}) {
  server.use(http.get(CHECKOUT_URL, () => HttpResponse.json(aCheckout(checkout))));
  return renderWithProviders([{ path: "/pay/:token", element: <PayPage /> }], {
    initialEntries: ["/pay/tok_abc"],
  });
}

async function fillCard(user: ReturnType<typeof userEvent.setup>, number = "4024007153763171") {
  await user.type(screen.getByLabelText("Número do cartão"), number);
  await user.type(screen.getByLabelText("Nome impresso no cartão"), "MARIA SILVA");
  await user.type(screen.getByLabelText("Validade (MM/AA)"), "1230");
  await user.type(screen.getByLabelText("CVV"), "987");
}

describe("checkout navigation", () => {
  it("theStepGoesToTheUrlAndTheBrowserBackLeavesTheCardForm", async () => {
    const { router } = renderCheckout();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cartão" }));
    await waitFor(() => expect(router.state.location.search).toBe("?etapa=cartao"));
    expect(screen.getByRole("heading", { name: "Pagar com cartão" })).toHaveFocus();

    await act(() => router.navigate(-1));

    expect(await screen.findByRole("heading", { name: "Como você quer pagar?" })).toHaveFocus();
    expect(router.state.location.search).toBe("?etapa=metodo");
  });

  it("theCardFormHasAWayBackAndSoDoesADecline", async () => {
    server.use(
      http.post(`${CHECKOUT_URL}/payments`, () =>
        HttpResponse.json(aCheckoutPayment({ method: "CARD", status: "FAILED", pix: null }), {
          status: 201,
        }),
      ),
    );
    renderCheckout();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cartão" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(await screen.findByRole("button", { name: "Cartão" }));
    await fillCard(user);
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));

    await user.click(
      await screen.findByRole("button", { name: "Escolher outra forma de pagamento" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Como você quer pagar?" }),
    ).toBeInTheDocument();
  });

  it("theBrowserBackOnAPixCancelsItOnTheServerFirst", async () => {
    const cancelled: string[] = [];
    server.use(
      http.post(`${CHECKOUT_URL}/payments`, () =>
        HttpResponse.json(aCheckoutPayment(), { status: 201 }),
      ),
      http.get(`${CHECKOUT_URL}/payments/pay_1`, () => HttpResponse.json(aCheckoutPayment())),
      http.post(`${CHECKOUT_URL}/payments/pay_1/cancel`, () => {
        cancelled.push("pay_1");
        return HttpResponse.json(aCheckoutPayment({ status: "CANCELED" }));
      }),
    );
    const { router } = renderCheckout();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Pix" }));
    expect(await screen.findByText("000201pixcopiaecola")).toBeInTheDocument();
    // The history entry is written after the render: going back before it would leave the page.
    await waitFor(() => expect(router.state.location.search).toBe("?etapa=pix"));
    // Let React render that entry: a back press lands on a page the payer has seen, and a pop
    // batched with the push into one render would never reach the page at all.
    await act(async () => {});

    await act(() => router.navigate(-1));

    expect(
      await screen.findByRole("heading", { name: "Como você quer pagar?" }),
    ).toBeInTheDocument();
    expect(cancelled).toEqual(["pay_1"]);
  });

  it("aCardTheAcquirerHasNotAnsweredWaitsOnAConfirmingScreen", async () => {
    server.use(
      http.post(`${CHECKOUT_URL}/payments`, () =>
        HttpResponse.json(
          aCheckoutPayment({ id: "pay_c", method: "CARD", status: "PENDING", pix: null }),
          { status: 201 },
        ),
      ),
      http.get(`${CHECKOUT_URL}/payments/pay_c`, () =>
        HttpResponse.json(
          aCheckoutPayment({ id: "pay_c", method: "CARD", status: "PENDING", pix: null }),
        ),
      ),
    );
    renderCheckout();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cartão" }));
    await fillCard(user);
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));

    expect(await screen.findByText("Estamos confirmando seu pagamento")).toBeInTheDocument();
  });

  it("anExpiredPixHidesTheCodeByTheClockAndMakesANewOne", async () => {
    const soon = new Date(Date.now() + 1_500).toISOString();
    const events: string[] = [];
    server.use(
      http.get(`${CHECKOUT_URL}/payments/pay_old`, () =>
        HttpResponse.json(aCheckoutPayment({ id: "pay_old" })),
      ),
      http.post(`${CHECKOUT_URL}/payments/pay_old/cancel`, () => {
        events.push("cancel");
        return HttpResponse.json(aCheckoutPayment({ id: "pay_old", status: "CANCELED" }));
      }),
      http.post(`${CHECKOUT_URL}/payments`, () => {
        events.push("create");
        return HttpResponse.json(
          aCheckoutPayment({
            id: "pay_new",
            pix: { copia_e_cola: "novopix", expires_at: "2099-01-01T00:00:00Z" },
          }),
          { status: 201 },
        );
      }),
      http.get(`${CHECKOUT_URL}/payments/pay_new`, () =>
        HttpResponse.json(aCheckoutPayment({ id: "pay_new" })),
      ),
    );
    renderCheckout({
      active_payment: aCheckoutPayment({
        id: "pay_old",
        pix: { copia_e_cola: "velhopix", expires_at: soon },
      }),
    });

    expect(await screen.findByText("velhopix")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Este Pix expirou" }, { timeout: 3_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("velhopix")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Gerar novo Pix" }));

    expect(await screen.findByText("novopix")).toBeInTheDocument();
    expect(events).toEqual(["cancel", "create"]);
  });
});

describe("card form", () => {
  it("askAmexForFourDigitsAndRefusesAnExpiredCard", async () => {
    let posts = 0;
    server.use(
      http.post(`${CHECKOUT_URL}/payments`, () => {
        posts += 1;
        return HttpResponse.json(aCheckoutPayment(), { status: 201 });
      }),
    );
    renderCheckout();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Cartão" }));

    await user.type(screen.getByLabelText("Número do cartão"), "378282246310005");
    expect(screen.getByLabelText("Número do cartão")).toHaveValue("3782 822463 10005");
    await user.type(screen.getByLabelText("Nome impresso no cartão"), "MARIA SILVA");
    await user.type(screen.getByLabelText("Validade (MM/AA)"), "0120");
    await user.type(screen.getByLabelText("CVV"), "123");
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));

    expect(screen.getByText("Cartão vencido.")).toBeInTheDocument();
    expect(screen.getByText("O código tem 4 dígitos.")).toBeInTheDocument();
    expect(screen.getByLabelText("CVV")).toHaveAttribute("aria-invalid", "true");
    expect(posts).toBe(0);
  });

  it("thePayButtonShowsTheTotalOfTheChosenInstallments", async () => {
    renderCheckout({
      installment_options: [
        { count: 1, installment_amount: 4990, total: 4990, interest_free: true },
        { count: 3, installment_amount: 1730, total: 5190, interest_free: false },
      ],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Cartão" }));

    expect(screen.getByRole("button", { name: /^Pagar R\$\s49,90$/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Parcelas"), "3");

    expect(
      screen.getByRole("option", { name: /^3x de R\$\s17,30 \(total R\$\s51,90\)$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pagar R\$\s51,90$/ })).toBeInTheDocument();
  });

  it("withoutOptionsFromTheGatewayItIsOnlyInFull", async () => {
    renderCheckout();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Cartão" }));

    expect(screen.queryByLabelText("Parcelas")).not.toBeInTheDocument();
    expect(screen.getByText("Pagamento à vista.")).toBeInTheDocument();
  });
});
