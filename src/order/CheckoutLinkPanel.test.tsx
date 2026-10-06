import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { anOrder } from "../test/fixtures/orders";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { CheckoutLinkPanel } from "./CheckoutLinkPanel";
import type { Order } from "./types";

function renderPanel(order: Order, initialUrl: string | null) {
  storeApiKey("gk_test_abc");
  return renderWithProviders([
    { path: "/", element: <CheckoutLinkPanel order={order} initialUrl={initialUrl} /> },
  ]);
}

describe("CheckoutLinkPanel", () => {
  it("showsTheInitialUrlAndCopiesIt", async () => {
    const user = userEvent.setup();
    // After setup(): user-event installs its own clipboard stub and would override an earlier one.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPanel(anOrder(), "https://pay.example/c/abc");

    expect(screen.getByText("https://pay.example/c/abc")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar" }));

    expect(writeText).toHaveBeenCalledWith("https://pay.example/c/abc");
    expect(await screen.findByText("Copiado")).toBeInTheDocument();
  });

  it("rotatesToANewUrlWhenThereIsNone", async () => {
    let key: string | null = null;
    server.use(
      http.post("http://localhost:8080/v1/orders/ord_00000001/checkout-token/rotate", ({ request }) => {
        key = request.headers.get("Idempotency-Key");
        return HttpResponse.json(anOrder({ checkout_url: "https://pay.example/c/new" }));
      }),
    );
    renderPanel(anOrder(), null);

    expect(screen.getByText(/O link só é exibido uma vez/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gerar novo link" }));

    expect(await screen.findByText("https://pay.example/c/new")).toBeInTheDocument();
    expect(key).toBeTruthy();
  });

  it("isHiddenForAPaidOrder", () => {
    renderPanel(anOrder({ status: "PAID" }), "https://pay.example/c/abc");

    expect(screen.queryByText("https://pay.example/c/abc")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar novo link" })).not.toBeInTheDocument();
  });
});
