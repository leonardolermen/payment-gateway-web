import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import type { Order } from "../order/types";
import { anOrder } from "../test/fixtures/orders";
import { aSubscription } from "../test/fixtures/subscriptions";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { InvoicesTable } from "./InvoicesTable";

const ROTATE = "http://localhost:8080/v1/orders/ord_invoice01/checkout-token/rotate";
const FRESH = "https://pay.example/c/fresh";

function anInvoice(overrides: Partial<Order> = {}): Order {
  return anOrder({
    id: "ord_invoice01",
    status: "PAID",
    subscription_id: "sub_00000001",
    invoice_number: 1,
    period: { start: "2026-09-06", end: "2026-10-06" },
    ...overrides,
  });
}

function renderTable(invoices: Order[], role: Role = "FINANCE") {
  setAccessToken("gs_test");
  // A card subscription with a saved card: the case where a "charge again" would have shown.
  const subscription = aSubscription({ method: "CARD", card_id: "card_00000001" });
  return renderWithProviders(
    [
      {
        path: "/",
        element: <InvoicesTable subscription={subscription} invoices={invoices} failed={false} />,
      },
    ],
    { me: aMe({ role }) },
  );
}

function stubClipboard() {
  // After userEvent.setup(): it installs its own clipboard stub and would override an earlier one.
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

function serveRotate(answer: () => Response) {
  const keys: (string | null)[] = [];
  server.use(
    http.post(ROTATE, ({ request }) => {
      keys.push(request.headers.get("Idempotency-Key"));
      return answer();
    }),
  );
  return keys;
}

const rotated = (checkoutUrl: string | null) =>
  HttpResponse.json(anInvoice({ status: "OPEN", checkout_url: checkoutUrl }));

async function generateLink(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Gerar novo link" }));
  const dialog = screen.getByRole("dialog", { name: "Gerar e copiar um link novo?" });
  await user.click(within(dialog).getByRole("button", { name: "Gerar e copiar" }));
}

describe("InvoicesTable", () => {
  it("listsTheInvoicesWithLinksToTheOrders", () => {
    renderTable(
      [
        anInvoice({
          id: "ord_invoice02",
          invoice_number: 2,
          status: "OPEN",
          amount: 2990,
          period: { start: "2026-10-06", end: "2026-11-06" },
        }),
        anInvoice(),
      ],
      "READONLY",
    );

    const rows = screen.getAllByRole("row");
    // The header row, then newest first as the gateway sends them.
    expect(rows).toHaveLength(3);
    const newest = rows[1] as HTMLElement;
    expect(within(newest).getByRole("link", { name: "#2" })).toHaveAttribute(
      "href",
      "/app/orders/ord_invoice02",
    );
    expect(within(newest).getByText("06/10/2026 – 06/11/2026")).toBeInTheDocument();
    expect(within(newest).getByText("R$ 29,90")).toBeInTheDocument();
    expect(within(newest).getByText("Aberta")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText("Paga")).toBeInTheDocument();
  });

  it("hasNoActionsColumnWithoutAnOpenInvoice", () => {
    renderTable([anInvoice(), anInvoice({ id: "ord_old", status: "EXPIRED" })]);

    expect(screen.queryByRole("columnheader", { name: "Ações" })).not.toBeInTheDocument();
  });

  it("neverOffersToChargeTheSavedCard", () => {
    renderTable([anInvoice({ status: "OPEN" })], "OWNER");

    expect(screen.getByRole("columnheader", { name: "Ações" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
  });

  it("offersNoLinkToReadonly", () => {
    renderTable([anInvoice({ status: "OPEN" })], "READONLY");

    expect(screen.queryByRole("button", { name: "Gerar novo link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Ações" })).not.toBeInTheDocument();
  });

  it("aNewLinkAsksFirstThenCopiesAndLeavesNoTraceInTheCaches", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    const keys = serveRotate(() => rotated(FRESH));
    const { queryClient } = renderTable([
      anInvoice({ status: "OPEN" }),
      anInvoice({ id: "ord_old" }),
    ]);

    // Only the open invoice has a payable link.
    expect(screen.getAllByRole("button", { name: "Gerar novo link" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Gerar novo link" }));

    const dialog = screen.getByRole("dialog", { name: "Gerar e copiar um link novo?" });
    expect(dialog).toHaveTextContent("O link que o pagador já tem deixa de valer.");
    expect(keys).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: "Gerar e copiar" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(FRESH));
    expect(await screen.findByText(/Link novo copiado/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBeTruthy();

    // A rotated link is handed out once: no query or mutation in the caches keeps it.
    const queries = queryClient.getQueryCache().getAll();
    const mutations = queryClient.getMutationCache().getAll();
    const cached = JSON.stringify([
      queries.map((query) => query.state.data),
      mutations.map((mutation) => mutation.state.data),
    ]);
    expect(cached).not.toContain("pay.example/c/fresh");
  });

  it("backingOutOfTheDialogKeepsTheOldLink", async () => {
    const user = userEvent.setup();
    const keys = serveRotate(() => rotated(FRESH));
    renderTable([anInvoice({ status: "OPEN" })]);

    await user.click(screen.getByRole("button", { name: "Gerar novo link" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(keys).toHaveLength(0);
  });

  it("saysTheOldLinkIsGoneWhenTheNewOneDidNotCome", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    serveRotate(() => rotated(null));
    renderTable([anInvoice({ status: "OPEN" })]);

    await generateLink(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O link anterior foi invalidado, mas o novo não veio. Tente de novo.",
    );
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText(/Link novo copiado/)).not.toBeInTheDocument();
  });

  it("aNewErrorClearsTheCopiedLine", async () => {
    const user = userEvent.setup();
    stubClipboard();
    let calls = 0;
    serveRotate(() => {
      calls += 1;
      return calls === 1
        ? rotated(FRESH)
        : HttpResponse.json(
            { type: "urn:gateway:ORDER_CLOSED", status: 409, detail: "closed" },
            { status: 409 },
          );
    });
    renderTable([anInvoice({ status: "OPEN" })]);

    await generateLink(user);
    expect(await screen.findByText(/Link novo copiado/)).toBeInTheDocument();

    await generateLink(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Esta cobrança já foi encerrada.");
    expect(screen.queryByText(/Link novo copiado/)).not.toBeInTheDocument();
  });
});
