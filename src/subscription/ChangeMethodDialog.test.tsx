import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import type { SavedCard } from "../customer/types";
import { aSavedCard } from "../test/fixtures/customers";
import { aSubscription } from "../test/fixtures/subscriptions";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { ChangeMethodDialog } from "./ChangeMethodDialog";
import { subscriptionKeys } from "./subscriptionApi";
import type { Subscription } from "./types";

const API = "http://localhost:8080/v1";
const SUBSCRIPTION = `${API}/subscriptions/sub_00000001`;

function serve(cards: SavedCard[], answer: () => Response) {
  const sent: unknown[] = [];
  server.use(
    http.get(`${API}/customers/cus_00000001/cards`, () => HttpResponse.json(cards)),
    http.patch(SUBSCRIPTION, async ({ request }) => {
      sent.push(await request.json());
      return answer();
    }),
  );
  return sent;
}

function renderDialog(subscription: Subscription = aSubscription()) {
  setAccessToken("gs_test");
  const onClose = vi.fn();
  const view = renderWithProviders(
    [{ path: "/", element: <ChangeMethodDialog subscription={subscription} onClose={onClose} /> }],
    { me: aMe({ role: "FINANCE" }) },
  );
  return { ...view, onClose };
}

function confirm() {
  return userEvent.click(screen.getByRole("button", { name: "Trocar método" }));
}

describe("ChangeMethodDialog", () => {
  it("sendsOnlyTheMethodForPixOrBoleto", async () => {
    const sent = serve([], () => HttpResponse.json(aSubscription({ method: "BOLECODE" })));
    const { onClose, queryClient } = renderDialog(aSubscription({ method: "CARD", card_id: "c" }));
    queryClient.setQueryData(subscriptionKeys.detail("sub_00000001"), aSubscription());

    expect(screen.getByRole("radio", { name: "Cartão" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Boleto" }));
    await confirm();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent).toEqual([{ method: "BOLECODE" }]);
    expect(queryClient.getQueryState(subscriptionKeys.detail("sub_00000001"))?.isInvalidated).toBe(
      true,
    );
  });

  it("sendsTheChosenSavedCardForCard", async () => {
    const sent = serve([aSavedCard({ id: "card_2", last4: "1111" })], () =>
      HttpResponse.json(aSubscription({ method: "CARD", card_id: "card_2" })),
    );
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole("radio", { name: "Cartão" }));
    const select = await screen.findByLabelText("Cartão salvo");
    await userEvent.selectOptions(
      select,
      within(select).getByRole("option", { name: /final 1111/ }),
    );
    await confirm();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent).toEqual([{ method: "CARD", card_id: "card_2" }]);
  });

  it("refusesCardWithoutASavedCard", async () => {
    const sent = serve([aSavedCard()], () => HttpResponse.json(aSubscription()));
    renderDialog();

    await userEvent.click(screen.getByRole("radio", { name: "Cartão" }));
    await screen.findByLabelText("Cartão salvo");
    await confirm();
    expect(await screen.findByText("Escolha um cartão salvo.")).toBeInTheDocument();

    // The link is how a new subscription gets its first card; a method change cannot send one.
    await userEvent.selectOptions(screen.getByLabelText("Cartão salvo"), "by-link");
    await confirm();
    expect(screen.getByText("Escolha um cartão salvo.")).toBeInTheDocument();

    expect(sent).toHaveLength(0);
  });

  it("saysWhenTheCustomerHasNoSavedCard", async () => {
    serve([], () => HttpResponse.json(aSubscription()));
    renderDialog();

    await userEvent.click(screen.getByRole("radio", { name: "Cartão" }));

    expect(await screen.findByText(/não tem cartão salvo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar método" })).toBeDisabled();
  });

  it("showsEveryRefusalOnTheDialog", async () => {
    let calls = 0;
    serve([aSavedCard()], () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json(
            {
              type: "urn:gateway:CARD_NOT_OWNED_BY_CUSTOMER",
              status: 422,
              detail: "card is not the customer's",
            },
            { status: 422 },
          )
        : HttpResponse.json(
            {
              type: "urn:gateway:CUSTOMER_ADDRESS_REQUIRED",
              status: 422,
              detail: "address required",
            },
            { status: 422 },
          );
    });
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole("radio", { name: "Cartão" }));
    const select = await screen.findByLabelText("Cartão salvo");
    await userEvent.selectOptions(select, "card_00000001");
    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent("Este cartão não é deste cliente.");

    await userEvent.click(screen.getByRole("radio", { name: "Boleto" }));
    await confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Boleto precisa do endereço do cliente.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
