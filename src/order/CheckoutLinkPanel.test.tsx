import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import { anOrder } from "../test/fixtures/orders";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { CheckoutLinkPanel } from "./CheckoutLinkPanel";
import type { Order } from "./types";

function renderPanel(order: Order, initialUrl: string | null, role: Role = "FINANCE") {
  setAccessToken("gs_test");
  return renderWithProviders(
    [{ path: "/", element: <CheckoutLinkPanel order={order} initialUrl={initialUrl} /> }],
    { me: aMe({ role }) },
  );
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
      http.post(
        "http://localhost:8080/v1/orders/ord_00000001/checkout-token/rotate",
        ({ request }) => {
          key = request.headers.get("Idempotency-Key");
          return HttpResponse.json(anOrder({ checkout_url: "https://pay.example/c/new" }));
        },
      ),
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

describe("CheckoutLinkPanel permissions", () => {
  // Rotating kills the link the payer already has: a write, not a view.
  it("readonlyCannotRotateTheLink", () => {
    renderPanel(anOrder(), "https://pay.example/c/abc", "READONLY");

    expect(screen.getByText("https://pay.example/c/abc")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar novo link" })).not.toBeInTheDocument();
  });

  it("financeRotatesTheLink", () => {
    renderPanel(anOrder(), "https://pay.example/c/abc", "FINANCE");

    expect(screen.getByRole("button", { name: "Gerar novo link" })).toBeInTheDocument();
  });
});

describe("CheckoutLinkPanel idempotency keys", () => {
  const ROTATE = "http://localhost:8080/v1/orders/ord_00000001/checkout-token/rotate";

  it("aRetriedRotateReusesTheKey", async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post(ROTATE, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return keys.length === 1
          ? HttpResponse.error()
          : HttpResponse.json(anOrder({ checkout_url: "https://pay.example/c/new" }));
      }),
    );
    renderPanel(anOrder(), null);

    await userEvent.click(screen.getByRole("button", { name: "Gerar novo link" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Gerar novo link" }));

    await screen.findByText("https://pay.example/c/new");
    expect(keys[1]).toBe(keys[0]);
  });

  it("aRotateAfterSuccessGetsANewKey", async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post(ROTATE, ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.json(anOrder({ checkout_url: `https://pay.example/c/${keys.length}` }));
      }),
    );
    renderPanel(anOrder(), null);

    await userEvent.click(screen.getByRole("button", { name: "Gerar novo link" }));
    await screen.findByText("https://pay.example/c/1");
    await userEvent.click(screen.getByRole("button", { name: "Gerar novo link" }));

    await screen.findByText("https://pay.example/c/2");
    expect(keys[1]).not.toBe(keys[0]);
  });
});

describe("CheckoutLinkPanel matches the approved mockup", () => {
  it("showsTheLinkInAMonoBoxWithAPrimaryCopy", () => {
    renderPanel(anOrder(), "https://pay.example/c/abc");

    expect(screen.getByText("https://pay.example/c/abc")).toHaveClass(
      "font-mono",
      "bg-surface-muted",
    );
    expect(screen.getByRole("button", { name: "Copiar" })).toHaveClass("bg-accent");
  });
});
