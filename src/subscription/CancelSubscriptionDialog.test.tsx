import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import { orderKeys } from "../order/orderApi";
import { anOrder } from "../test/fixtures/orders";
import { aSubscription } from "../test/fixtures/subscriptions";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { serverError, withTheGatewayKeyRule } from "../test/idempotency";
import { renderWithProviders } from "../test/render";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";
import { subscriptionKeys } from "./subscriptionApi";

const CANCEL = "http://localhost:8080/v1/subscriptions/sub_00000001/cancel";

type Sent = { body: unknown; key: string | null };

function serveCancel(answer: (key: string | null) => Response) {
  const sent: Sent[] = [];
  server.use(
    http.post(CANCEL, async ({ request }) => {
      const key = request.headers.get("Idempotency-Key");
      sent.push({ body: await request.json(), key });
      return answer(key);
    }),
  );
  return sent;
}

function renderDialog(onClose = vi.fn()) {
  setAccessToken("gs_test");
  const view = renderWithProviders(
    [
      {
        path: "/",
        element: <CancelSubscriptionDialog subscription={aSubscription()} onClose={onClose} />,
      },
    ],
    { me: aMe({ role: "FINANCE" }) },
  );
  return { ...view, onClose };
}

describe("CancelSubscriptionDialog", () => {
  it("defaultsToTheEndOfThePeriod", async () => {
    const sent = serveCancel(() =>
      HttpResponse.json(aSubscription({ cancel_at_period_end: true })),
    );
    renderDialog();

    expect(screen.getByRole("radio", { name: "No fim do período" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Agora" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({ at_period_end: true });
    expect(sent[0]?.key).toBeTruthy();
  });

  it("cancelNowSendsAtPeriodEndFalse", async () => {
    const sent = serveCancel(() =>
      HttpResponse.json(
        {
          type: "urn:gateway:SUBSCRIPTION_NOT_ACTIVE",
          status: 409,
          detail: "subscription sub_00000001 is CANCELED",
        },
        { status: 409 },
      ),
    );
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole("radio", { name: "Agora" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({ at_period_end: false });

    // The refusal lands in the dialog, which stays up.
    const dialog = screen.getByRole("dialog", { name: "Cancelar assinatura?" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta assinatura não está ativa.");
    expect(dialog).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("successInvalidatesTheSubscriptionsAndCloses", async () => {
    serveCancel(() => HttpResponse.json(aSubscription({ status: "CANCELED" })));
    const { onClose, queryClient } = renderDialog();
    queryClient.setQueryData(subscriptionKeys.detail("sub_00000001"), aSubscription());
    queryClient.setQueryData(orderKeys.detail("ord_invoice"), anOrder());

    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(queryClient.getQueryState(subscriptionKeys.detail("sub_00000001"))?.isInvalidated).toBe(
      true,
    );
    // A cancel now cancels the open invoice too.
    expect(queryClient.getQueryState(orderKeys.detail("ord_invoice"))?.isInvalidated).toBe(true);
  });

  it("keepsTheKeyAfterAnUncertainFailureUntilTheOperatorStartsOver", async () => {
    const sent = serveCancel(
      withTheGatewayKeyRule((run) =>
        run === 1
          ? serverError()
          : HttpResponse.json(aSubscription({ cancel_at_period_end: true })),
      ),
    );
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A tentativa anterior não terminou.",
    );
    expect(sent[1]?.key).toBe(sent[0]?.key);

    await userEvent.click(screen.getByRole("button", { name: "Recomeçar" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent).toHaveLength(3);
    expect(sent[2]?.key).not.toBe(sent[0]?.key);
  });
});
