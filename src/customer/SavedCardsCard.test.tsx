import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import { aSavedCard } from "../test/fixtures/customers";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { cardKeys } from "./cardApi";
import { SavedCardsCard } from "./SavedCardsCard";
import type { SavedCard } from "./types";

const CARDS_URL = "http://localhost:8080/v1/customers/cus_00000001/cards";
const CARD_URL = "http://localhost:8080/v1/cards/:id";

function renderCards(cards: SavedCard[], role: Role = "OWNER") {
  setAccessToken("gs_test");
  server.use(http.get(CARDS_URL, () => HttpResponse.json(cards)));

  return renderWithProviders(
    [{ path: "/app/customers/:id", element: <SavedCardsCard customerId="cus_00000001" /> }],
    { initialEntries: ["/app/customers/cus_00000001"], me: aMe({ role }) },
  );
}

async function rowOf(text: string): Promise<HTMLElement> {
  const cell = await screen.findByText(text);
  const row = cell.closest("tr");
  if (!row) {
    throw new Error(`no row for ${text}`);
  }
  return row;
}

describe("SavedCardsCard", () => {
  it("listsBrandFinalExpiryAndHolder", async () => {
    renderCards([aSavedCard()]);

    const row = await rowOf("final 4242");

    expect(within(row).getByText("VISA")).toBeInTheDocument();
    expect(within(row).getByText("08/2029")).toBeInTheDocument();
    expect(within(row).getByText("MARIA SOUZA")).toBeInTheDocument();
  });

  it("saysWhenThereIsNoSavedCard", async () => {
    renderCards([]);

    expect(await screen.findByText("Nenhum cartão salvo.")).toBeInTheDocument();
  });

  it("hidesRemoveFromFinance", async () => {
    renderCards([aSavedCard()], "FINANCE");

    await rowOf("final 4242");

    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
  });

  it("ownerRemovesACardAfterConfirming", async () => {
    let cards = [aSavedCard(), aSavedCard({ id: "card_00000002", last4: "1111" })];
    const deleted: string[] = [];
    renderCards(cards);
    server.use(
      http.get(CARDS_URL, () => HttpResponse.json(cards)),
      http.delete(CARD_URL, ({ params }) => {
        deleted.push(String(params.id));
        cards = cards.filter((card) => card.id !== params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const row = await rowOf("final 4242");
    await userEvent.click(within(row).getByRole("button", { name: "Remover" }));
    const dialog = screen.getByRole("dialog", { name: "Remover cartão?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(screen.queryByText("final 4242")).not.toBeInTheDocument());
    expect(deleted).toEqual(["card_00000001"]);
    expect(screen.getByText("final 1111")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // The gateway answers 204 even for a card a subscription charges; a failure is anything else.
  it("aFailedRemovalShowsTheErrorOnItsRow", async () => {
    renderCards([aSavedCard(), aSavedCard({ id: "card_00000002", last4: "1111" })]);
    server.use(
      http.delete(CARD_URL, () =>
        HttpResponse.json(
          { type: "urn:gateway:NOT_FOUND", status: 404, detail: "card not found" },
          { status: 404 },
        ),
      ),
    );

    const row = await rowOf("final 4242");
    await userEvent.click(within(row).getByRole("button", { name: "Remover" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Remover cartão?" })).getByRole("button", {
        name: "Remover",
      }),
    );

    expect(await within(row).findByRole("alert")).toHaveTextContent("Não encontrado.");
    expect(screen.getByText("final 4242")).toBeInTheDocument();
    expect(within(await rowOf("final 1111")).queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("warnsThatASubscriptionChargingTheCardWillFail", async () => {
    renderCards([aSavedCard()]);

    const row = await rowOf("final 4242");
    await userEvent.click(within(row).getByRole("button", { name: "Remover" }));

    expect(screen.getByRole("dialog", { name: "Remover cartão?" })).toHaveTextContent(
      "Se uma assinatura cobra este cartão, a próxima cobrança vai falhar.",
    );
  });

  it("aRemovedCardLeavesItsCachedDetail", async () => {
    const { queryClient } = renderCards([aSavedCard()]);
    queryClient.setQueryData(cardKeys.detail("card_00000001"), aSavedCard());
    server.use(http.delete(CARD_URL, () => new HttpResponse(null, { status: 204 })));

    const row = await rowOf("final 4242");
    await userEvent.click(within(row).getByRole("button", { name: "Remover" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Remover cartão?" })).getByRole("button", {
        name: "Remover",
      }),
    );

    await waitFor(() =>
      expect(queryClient.getQueryState(cardKeys.detail("card_00000001"))?.isInvalidated).toBe(true),
    );
  });
});
