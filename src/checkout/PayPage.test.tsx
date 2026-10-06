import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { aCheckout, CHECKOUT_URL, expectNoAuthorization } from "../test/fixtures/checkout";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { PayPage } from "./PayPage";

vi.mock("qrcode", () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

function renderPage() {
  return renderWithProviders([{ path: "/pay/:token", element: <PayPage /> }], {
    initialEntries: ["/pay/tok_abc"],
  });
}

describe("PayPage", () => {
  it("aPaidOrderShowsPaidOnEveryLoad", async () => {
    server.use(
      http.get(CHECKOUT_URL, ({ request }) => {
        expectNoAuthorization(request);
        return HttpResponse.json(aCheckout({ status: "PAID" }));
      }),
    );

    const first = renderPage();
    expect(await screen.findByText(/Pagamento (confirmado|autorizado)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pix" })).not.toBeInTheDocument();
    first.unmount();

    renderPage();
    expect(await screen.findByText(/Pagamento (confirmado|autorizado)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pix" })).not.toBeInTheDocument();
  });

  it("aPaidOrderReadsConfirmadoNotAutorizado", async () => {
    server.use(http.get(CHECKOUT_URL, () => HttpResponse.json(aCheckout({ status: "PAID" }))));

    renderPage();

    expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();
    expect(screen.queryByText("Pagamento autorizado")).not.toBeInTheDocument();
  });

  it("aClosedOrderDuringAPixAttemptIsUnavailable", async () => {
    server.use(
      http.get(CHECKOUT_URL, () => HttpResponse.json(aCheckout())),
      http.post(`${CHECKOUT_URL}/payments`, ({ request }) => {
        expectNoAuthorization(request);
        return HttpResponse.json(
          { type: "urn:gateway:GONE", status: 410, detail: "closed" },
          { status: 410 },
        );
      }),
    );

    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Pix" }));

    expect(
      await screen.findByText("Este link de pagamento não está mais disponível."),
    ).toBeInTheDocument();
  });

  it("anOpenOrderShowsOnlyTheAvailableMethods", async () => {
    server.use(
      http.get(CHECKOUT_URL, ({ request }) => {
        expectNoAuthorization(request);
        return HttpResponse.json(aCheckout({ methods: ["PIX"] }));
      }),
    );

    renderPage();

    expect(await screen.findByRole("button", { name: "Pix" })).toBeInTheDocument();
    expect(screen.getByText("Loja Exemplo")).toBeInTheDocument();
    expect(screen.getByText("R$ 49,90")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cartão" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Boleto" })).not.toBeInTheDocument();
  });

  it("anUnknownTokenShowsInvalidLink", async () => {
    server.use(
      http.get(CHECKOUT_URL, ({ request }) => {
        expectNoAuthorization(request);
        return HttpResponse.json(
          { type: "urn:gateway:NOT_FOUND", status: 404, detail: "not found" },
          { status: 404 },
        );
      }),
    );

    renderPage();

    expect(await screen.findByText("Link inválido.")).toBeInTheDocument();
  });
});
