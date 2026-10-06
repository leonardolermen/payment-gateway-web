import { act, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const ATTEMPT_URL = `${CHECKOUT_URL}/payments/pay_1`;
const RATE_LIMITED = "Muitas tentativas. Aguarde um instante.";

function renderPixInProgress() {
  server.use(
    http.get(CHECKOUT_URL, ({ request }) => {
      expectNoAuthorization(request);
      return HttpResponse.json(aCheckout({ active_payment: aCheckoutPayment() }));
    }),
  );

  return renderWithProviders([{ path: "/pay/:token", element: <PayPage /> }], {
    initialEntries: ["/pay/tok_abc"],
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PixStep", () => {
  it("pollsUntilCompletedThenShowsPaid", async () => {
    const statuses = ["PENDING", "PENDING", "COMPLETED"] as const;
    let calls = 0;
    server.use(
      http.get(ATTEMPT_URL, ({ request }) => {
        expectNoAuthorization(request);
        const status = statuses[Math.min(calls, statuses.length - 1)];
        calls += 1;
        const paidAt = status === "COMPLETED" ? "2026-10-06T12:05:00Z" : null;
        return HttpResponse.json(aCheckoutPayment({ status, paid_at: paidAt }));
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPixInProgress();
    expect(await screen.findByText("000201pixcopiaecola")).toBeInTheDocument();

    await advance(3_100);
    await advance(3_100);

    expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();
    expect(calls).toBe(3);
  });

  it("aRateLimitPausesPollingForRetryAfter", async () => {
    let calls = 0;
    server.use(
      http.get(ATTEMPT_URL, ({ request }) => {
        expectNoAuthorization(request);
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { type: "urn:gateway:RATE_LIMITED", status: 429, detail: "slow down" },
            { status: 429, headers: { "Retry-After": "5" } },
          );
        }
        return HttpResponse.json(aCheckoutPayment());
      }),
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPixInProgress();
    expect(await screen.findByText(RATE_LIMITED)).toBeInTheDocument();
    expect(calls).toBe(1);

    await advance(4_500);
    expect(calls).toBe(1);

    await advance(1_000);
    expect(calls).toBe(2);
    expect(screen.queryByText(RATE_LIMITED)).not.toBeInTheDocument();
  });
});
