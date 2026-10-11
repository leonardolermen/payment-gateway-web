import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import { anOrder } from "../test/fixtures/orders";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { serverError, withTheGatewayKeyRule } from "../test/idempotency";
import { renderWithProviders } from "../test/render";
import { CheckoutLinkPanel } from "./CheckoutLinkPanel";
import type { Order } from "./types";

// Rotating kills the link the payer holds: the panel asks first, every time.
async function rotate() {
  await userEvent.click(screen.getByRole("button", { name: "Gerar novo link" }));
  const dialog = screen.getByRole("dialog", { name: "Gerar um link novo?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Gerar" }));
}

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
    await rotate();

    expect(await screen.findByText("https://pay.example/c/new")).toBeInTheDocument();
    expect(key).toBeTruthy();
  });

  // The rotated link is shown once: the mutation that brought it must not outlive the panel.
  it("theRotatedUrlLeavesTheMutationCacheWithThePanel", async () => {
    server.use(
      http.post("http://localhost:8080/v1/orders/ord_00000001/checkout-token/rotate", () =>
        HttpResponse.json(anOrder({ checkout_url: "https://pay.example/c/new" })),
      ),
    );
    const { queryClient, unmount } = renderPanel(anOrder(), null);

    await rotate();
    await screen.findByText("https://pay.example/c/new");
    unmount();

    await waitFor(() =>
      expect(
        queryClient
          .getMutationCache()
          .getAll()
          .some((mutation) => JSON.stringify(mutation.state.data ?? null).includes("c/new")),
      ).toBe(false),
    );
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

    await rotate();
    await screen.findByRole("alert");
    await rotate();

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

    await rotate();
    await screen.findByText("https://pay.example/c/1");
    await rotate();

    await screen.findByText("https://pay.example/c/2");
    expect(keys[1]).not.toBe(keys[0]);
  });
});

describe("CheckoutLinkPanel asks first", () => {
  it("backingOutSendsNothing", async () => {
    let requests = 0;
    server.use(
      http.post("http://localhost:8080/v1/orders/ord_00000001/checkout-token/rotate", () => {
        requests += 1;
        return HttpResponse.json(anOrder({ checkout_url: "https://pay.example/c/new" }));
      }),
    );
    renderPanel(anOrder(), null);

    await userEvent.click(screen.getByRole("button", { name: "Gerar novo link" }));
    expect(screen.getByRole("dialog", { name: "Gerar um link novo?" })).toHaveTextContent(
      "O link que o pagador já tem deixa de valer.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(requests).toBe(0);
  });
});

describe("CheckoutLinkPanel held key", () => {
  it("aHeldKeyOffersToStartOver", async () => {
    const keys: (string | null)[] = [];
    const answer = withTheGatewayKeyRule((run) =>
      run === 1
        ? serverError()
        : HttpResponse.json(anOrder({ checkout_url: "https://pay.example/c/new" })),
    );
    server.use(
      http.post(
        "http://localhost:8080/v1/orders/ord_00000001/checkout-token/rotate",
        ({ request }) => {
          const key = request.headers.get("Idempotency-Key");
          keys.push(key);
          return answer(key);
        },
      ),
    );
    renderPanel(anOrder(), null);

    await rotate();
    await screen.findByRole("alert");
    await rotate();
    await userEvent.click(await screen.findByRole("button", { name: "Recomeçar" }));
    await rotate();

    await screen.findByText("https://pay.example/c/new");
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
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
