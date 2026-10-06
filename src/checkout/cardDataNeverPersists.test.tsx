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

// Three digits occur inside ids, classes and amounts; only a standalone 987 is the CVV leaking.
const CVV_TOKEN = /(?<![0-9A-Za-z])987(?![0-9A-Za-z])/;

describe("card data", () => {
  it("neverPersistsAnywhereAfterTheResponse", async () => {
    server.use(
      http.get(CHECKOUT_URL, ({ request }) => {
        expectNoAuthorization(request);
        return HttpResponse.json(aCheckout({ methods: ["CARD"] }));
      }),
      http.post(`${CHECKOUT_URL}/payments`, ({ request }) => {
        expectNoAuthorization(request);
        return HttpResponse.json(
          aCheckoutPayment({
            method: "CARD",
            status: "COMPLETED",
            pix: null,
            card: { brand: "visa", last4: "3171", installments: 1 },
            paid_at: "2026-10-06T12:05:00Z",
          }),
          { status: 201 },
        );
      }),
    );

    const { queryClient } = renderWithProviders([{ path: "/pay/:token", element: <PayPage /> }], {
      initialEntries: ["/pay/tok_abc"],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Cartão" }));
    await user.type(screen.getByLabelText("Número do cartão"), "4024007153763171");
    await user.type(screen.getByLabelText("Nome impresso no cartão"), "MARIA SILVA");
    await user.type(screen.getByLabelText("Validade (MM/AA)"), "1230");
    await user.type(screen.getByLabelText("CVV"), "987");
    await user.click(screen.getByRole("button", { name: "Pagar" }));
    expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();

    const places = {
      localStorage: JSON.stringify(Object.entries(localStorage)),
      sessionStorage: JSON.stringify(Object.entries(sessionStorage)),
      queryCache: JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
      body: document.body.innerHTML,
    };
    for (const [place, content] of Object.entries(places)) {
      expect(content, place).not.toContain("4024007153763171");
      expect(content, place).not.toContain("4024 0071 5376 3171");
      expect(content, place).not.toContain("12/30");
      expect(content, place).not.toMatch(CVV_TOKEN);
    }
  });
});
