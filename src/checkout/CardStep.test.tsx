import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  aCheckout,
  aCheckoutPayment,
  CHECKOUT_URL,
  expectNoAuthorization,
} from "../test/fixtures/checkout";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { PayPage } from "./PayPage";

vi.mock("qrcode", () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

const OPTIONS = [
  { count: 1, installment_amount: 4990, total: 4990, interest_free: true },
  { count: 2, installment_amount: 2495, total: 4990, interest_free: true },
  { count: 3, installment_amount: 1730, total: 5190, interest_free: false },
];

async function openCardForm() {
  server.use(
    http.get(CHECKOUT_URL, ({ request }) => {
      expectNoAuthorization(request);
      return HttpResponse.json(aCheckout({ methods: ["CARD"], installment_options: OPTIONS }));
    }),
  );

  renderWithProviders([{ path: "/pay/:token", element: <PayPage /> }], {
    initialEntries: ["/pay/tok_abc"],
  });

  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Cartão" }));

  return user;
}

async function fillCard(user: ReturnType<typeof userEvent.setup>, number: string) {
  await user.type(screen.getByLabelText("Número do cartão"), number);
  await user.type(screen.getByLabelText("Nome impresso no cartão"), "MARIA SILVA");
  await user.type(screen.getByLabelText("Validade (MM/AA)"), "1230");
  await user.type(screen.getByLabelText("CVV"), "987");
}

describe("CardStep", () => {
  it("aDeclinedCardShowsTheMessageAndClearsTheFields", async () => {
    server.use(
      http.post(`${CHECKOUT_URL}/payments`, ({ request }) => {
        expectNoAuthorization(request);
        return HttpResponse.json(
          { type: "urn:gateway:CARD_DECLINED", status: 402, detail: "declined" },
          { status: 402 },
        );
      }),
    );

    const user = await openCardForm();
    await fillCard(user, "4024007153763171");
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));

    expect(
      await screen.findByText("Cartão recusado. Tente outro cartão ou outro método."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Número do cartão")).toHaveValue("");
    expect(screen.getByLabelText("Nome impresso no cartão")).toHaveValue("");
    expect(screen.getByLabelText("Validade (MM/AA)")).toHaveValue("");
    expect(screen.getByLabelText("CVV")).toHaveValue("");
  });

  it("anInvalidLuhnBlocksSubmit", async () => {
    let posts = 0;
    server.use(
      http.post(`${CHECKOUT_URL}/payments`, () => {
        posts += 1;
        return HttpResponse.json(aCheckoutPayment({ method: "CARD", status: "COMPLETED" }));
      }),
    );

    const user = await openCardForm();
    await fillCard(user, "4024007153763172");

    expect(screen.getByText("Número de cartão inválido.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));
    expect(posts).toBe(0);
  });

  it("aPaidCardShowsPaid", async () => {
    let body: unknown = null;
    server.use(
      http.post(`${CHECKOUT_URL}/payments`, async ({ request }) => {
        expectNoAuthorization(request);
        body = await request.json();
        return HttpResponse.json(
          aCheckoutPayment({
            method: "CARD",
            status: "COMPLETED",
            pix: null,
            card: { brand: "visa", last4: "3171", installments: 3 },
            paid_at: "2026-10-06T12:05:00Z",
          }),
          { status: 201 },
        );
      }),
    );

    const user = await openCardForm();
    await fillCard(user, "4024007153763171");
    await user.selectOptions(screen.getByLabelText("Parcelas"), "3");
    await user.click(screen.getByRole("button", { name: /^Pagar/ }));

    expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();
    expect(body).toEqual({
      method: "CARD",
      card: { number: "4024007153763171", holder: "MARIA SILVA", expiry: "12/2030", cvv: "987" },
      installments: 3,
    });
  });
});
