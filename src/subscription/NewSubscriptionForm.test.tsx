import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import type { SavedCard } from "../customer/types";
import { aCustomer, aSavedCard } from "../test/fixtures/customers";
import { anOrder } from "../test/fixtures/orders";
import { aPlan } from "../test/fixtures/plans";
import { aSubscription } from "../test/fixtures/subscriptions";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { NewSubscriptionForm } from "./NewSubscriptionForm";
import { subscriptionKeys } from "./subscriptionApi";
import { SubscriptionsWorkspace } from "./SubscriptionsWorkspace";
import type { Subscription } from "./types";

const API = "http://localhost:8080/v1";
const SUBSCRIPTIONS = `${API}/subscriptions`;
const LINK = "https://pay.example/c/one-time-abc";

type Sent = { body: Record<string, unknown>; key: string | null };

function serveTheBasics(cards: SavedCard[] = []) {
  const planSearches: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/customers`, () => HttpResponse.json([aCustomer()])),
    http.get(`${API}/customers/:id/cards`, () => HttpResponse.json(cards)),
    http.get(`${API}/plans`, ({ request }) => {
      planSearches.push(new URL(request.url).searchParams);
      return HttpResponse.json([
        aPlan({ id: "plan_mensal", name: "Mensal Pro" }),
        aPlan({ id: "plan_anual", name: "Anual", amount: 49900, interval: "YEAR" }),
      ]);
    }),
    http.get(`${API}/plans/:id`, () => HttpResponse.json(aPlan())),
    http.get(SUBSCRIPTIONS, () => HttpResponse.json([])),
  );
  return planSearches;
}

function servePost(answer: () => Response) {
  const sent: Sent[] = [];
  server.use(
    http.post(SUBSCRIPTIONS, async ({ request }) => {
      sent.push({
        body: (await request.json()) as Record<string, unknown>,
        key: request.headers.get("Idempotency-Key"),
      });
      return answer();
    }),
  );
  return sent;
}

function created(overrides: Partial<Subscription> = {}) {
  return HttpResponse.json(aSubscription({ id: "sub_new", ...overrides }), { status: 201 });
}

// Mirrors the app's routes: the form is the workspace's right panel.
function renderForm(role: Role = "FINANCE", path = "/app/subscriptions/new") {
  setAccessToken("gs_test");
  return renderWithProviders(
    [
      {
        path: "/app/subscriptions",
        element: <SubscriptionsWorkspace />,
        children: [
          { index: true, element: <div>nenhuma</div> },
          { path: "new", element: <NewSubscriptionForm /> },
          { path: ":id", element: <div>detalhe</div> },
        ],
      },
    ],
    { initialEntries: [path], me: aMe({ role }) },
  );
}

async function chooseCustomer() {
  await userEvent.type(await screen.findByLabelText("Documento do cliente"), "52998224725");
  await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await userEvent.click(await screen.findByRole("button", { name: "Selecionar" }));
}

async function choosePlan(name = "Mensal Pro") {
  const plan = screen.getByLabelText("Plano");
  await within(plan).findByRole("option", { name: new RegExp(name) });
  await userEvent.selectOptions(plan, within(plan).getByRole("option", { name: new RegExp(name) }));
}

async function fillPix() {
  await chooseCustomer();
  await choosePlan();
  await userEvent.click(screen.getByRole("radio", { name: "Pix" }));
}

function submit() {
  return userEvent.click(screen.getByRole("button", { name: "Criar assinatura" }));
}

describe("NewSubscriptionForm", () => {
  it("offersOnlyActivePlansAnExistingCustomerAndTheThreeMethods", async () => {
    const planSearches = serveTheBasics();
    renderForm();

    const plan = screen.getByLabelText("Plano");
    expect(await within(plan).findByRole("option", { name: /Mensal Pro/ })).toBeInTheDocument();
    expect(within(plan).getByRole("option", { name: /Anual/ })).toBeInTheDocument();
    expect(planSearches.map((search) => search.get("active"))).toEqual(["true"]);

    // The subscription API takes a customer_id only: there is no inline new customer here.
    expect(screen.getByLabelText("Documento do cliente")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Novo" })).not.toBeInTheDocument();

    expect(screen.getByRole("radio", { name: "Pix" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Boleto" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Cartão" })).toBeInTheDocument();
    expect(screen.getByLabelText("Início")).toHaveAttribute("type", "date");
  });

  it("refusesASubmitWithoutCustomerOrPlan", async () => {
    serveTheBasics();
    const sent = servePost(() => created());
    renderForm();

    await submit();

    expect(await screen.findByText("Escolha um cliente.")).toBeInTheDocument();
    expect(screen.getByText("Escolha um plano.")).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("sendsTheExactBodyAndNavigatesToTheSubscription", async () => {
    serveTheBasics();
    const sent = servePost(() => created({ status: "ACTIVE" }));
    const { router } = renderForm();

    await chooseCustomer();
    await choosePlan("Anual");
    await userEvent.click(screen.getByRole("radio", { name: "Boleto" }));
    await userEvent.type(screen.getByLabelText("Início"), "2026-11-01");
    await submit();

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/subscriptions/sub_new"));
    expect(sent[0]?.body).toEqual({
      customer_id: "cus_00000001",
      plan_id: "plan_anual",
      method: "BOLECODE",
      start_at: "2026-11-01",
    });
  });

  it("savedCardsListEachCardThenTheLinkAndSendTheChosenCard", async () => {
    serveTheBasics([
      aSavedCard({ id: "card_visa", brand: "VISA", last4: "4242", expiry: "12/2030" }),
      aSavedCard({ id: "card_master", brand: "MASTERCARD", last4: "5454", expiry: "01/2031" }),
    ]);
    const sent = servePost(() => created({ method: "CARD", card_id: "card_master" }));
    renderForm();

    await chooseCustomer();
    await choosePlan();
    await userEvent.click(screen.getByRole("radio", { name: "Cartão" }));

    const card = await screen.findByLabelText("Cartão salvo");
    expect(
      within(card)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Escolha um cartão…",
      "Visa final 4242 · 12/2030",
      "Mastercard final 5454 · 01/2031",
      "O pagador cadastra o cartão pelo link",
    ]);

    await userEvent.selectOptions(card, "Mastercard final 5454 · 01/2031");
    await submit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toEqual({
      customer_id: "cus_00000001",
      plan_id: "plan_mensal",
      method: "CARD",
      card_id: "card_master",
    });
  });

  it("withoutSavedCardsOnlyTheLinkIsOffered", async () => {
    serveTheBasics([]);
    renderForm();

    await chooseCustomer();
    await userEvent.click(screen.getByRole("radio", { name: "Cartão" }));

    const card = await screen.findByLabelText("Cartão salvo");
    expect(
      within(card)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Escolha um cartão…", "O pagador cadastra o cartão pelo link"]);
  });

  it("cardByLinkShowsTheLinkOnce", async () => {
    const user = userEvent.setup();
    // After setup(): user-event installs its own clipboard stub and would override an earlier one.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    serveTheBasics([aSavedCard({ id: "card_visa" })]);
    const sent = servePost(() =>
      created({
        status: "INCOMPLETE",
        method: "CARD",
        latest_order: anOrder({ id: "ord_first", status: "OPEN", checkout_url: LINK }),
      }),
    );
    const { router, queryClient } = renderForm();

    await chooseCustomer();
    await choosePlan();
    await user.click(screen.getByRole("radio", { name: "Cartão" }));
    await user.selectOptions(
      await screen.findByLabelText("Cartão salvo"),
      "O pagador cadastra o cartão pelo link",
    );
    await submit();

    expect(await screen.findByText(LINK)).toBeInTheDocument();
    expect(sent[0]?.body).not.toHaveProperty("card_id");
    expect(sent[0]?.body).toMatchObject({ method: "CARD" });
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith(LINK);

    await user.click(screen.getByRole("button", { name: "Ver assinatura" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/app/subscriptions/sub_new"));

    // The link is shown once: nothing the panel keeps may hold it after the panel is gone.
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(queryClient.getQueryData(subscriptionKeys.detail("sub_new"))).toBeUndefined();
    const cached = queryClient
      .getQueryCache()
      .findAll()
      .map((query) => JSON.stringify(query.state.data ?? null));
    expect(cached.some((data) => data.includes(LINK))).toBe(false);
    const mutations = queryClient
      .getMutationCache()
      .getAll()
      .map((mutation) => JSON.stringify(mutation.state.data ?? null));
    expect(mutations.some((data) => data.includes(LINK))).toBe(false);

    await router.navigate("/app/subscriptions/new");
    expect(await screen.findByRole("button", { name: "Criar assinatura" })).toBeInTheDocument();
    expect(screen.queryByText(LINK)).not.toBeInTheDocument();
  });

  it("keepsTheIdempotencyKeyAcrossARetryAndRenewsItAfterSuccess", async () => {
    serveTheBasics();
    let answers = 0;
    const sent = servePost(() => {
      answers += 1;
      return answers === 1
        ? HttpResponse.json({ type: "urn:gateway:INTERNAL" }, { status: 500 })
        : created();
    });
    const { router } = renderForm();

    await fillPix();
    await submit();
    await screen.findByRole("alert");
    await submit();
    await waitFor(() => expect(router.state.location.pathname).toBe("/app/subscriptions/sub_new"));

    await router.navigate("/app/subscriptions/new");
    await fillPix();
    await submit();
    await waitFor(() => expect(sent).toHaveLength(3));

    expect(sent[0]?.key).toBeTruthy();
    expect(sent[1]?.key).toBe(sent[0]?.key);
    expect(sent[2]?.key).not.toBe(sent[0]?.key);
  });

  it("keepsTheIdempotencyKeyAcrossARetryAfterANetworkError", async () => {
    serveTheBasics();
    let answers = 0;
    const sent = servePost(() => {
      answers += 1;
      return answers === 1 ? HttpResponse.error() : created();
    });
    renderForm();

    await fillPix();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível falar");
    await submit();

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.key).toBe(sent[0]?.key);
  });

  it.each([
    ["PLAN_INACTIVE", "Este plano está inativo."],
    ["CARD_REQUIRED", "Escolha um cartão ou envie o link para o pagador."],
    ["CARD_NOT_OWNED_BY_CUSTOMER", "Este cartão não é deste cliente."],
    ["CUSTOMER_ADDRESS_REQUIRED", "Boleto precisa do endereço do cliente."],
  ])("unprocessable %s lands on the form alert", async (code, message) => {
    serveTheBasics();
    servePost(() =>
      HttpResponse.json(
        { type: `urn:gateway:${code}`, status: 422, detail: "raw" },
        { status: 422 },
      ),
    );
    renderForm();

    await fillPix();
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("readOnlyGetsTheHintInsteadOfTheForm", async () => {
    serveTheBasics();
    renderForm("READONLY");

    expect(await screen.findByText(/Escolha uma assinatura na lista/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar assinatura" })).not.toBeInTheDocument();
  });

  // A 5xx may have created the subscription: whatever the form says now, the retry is the same
  // intent and must replay under the same key.
  it("keepsTheKeyAfterA5xxEvenWhenTheFormChanges", async () => {
    serveTheBasics();
    let answers = 0;
    const sent = servePost(() => {
      answers += 1;
      return answers === 1
        ? HttpResponse.json({ type: "urn:gateway:INTERNAL" }, { status: 500 })
        : created();
    });
    renderForm();

    await fillPix();
    await submit();
    await screen.findByRole("alert");
    await userEvent.type(screen.getByLabelText("Início"), "2026-11-01");
    await submit();

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.body).toHaveProperty("start_at", "2026-11-01");
    expect(sent[1]?.key).toBe(sent[0]?.key);
  });

  // A 422 is a clear "nothing was created": the corrected form is a new request.
  it("renewsTheKeyAfterADefinite422", async () => {
    serveTheBasics();
    let answers = 0;
    const sent = servePost(() => {
      answers += 1;
      return answers === 1
        ? HttpResponse.json(
            { type: "urn:gateway:CUSTOMER_ADDRESS_REQUIRED", status: 422 },
            { status: 422 },
          )
        : created();
    });
    renderForm();

    await chooseCustomer();
    await choosePlan();
    await userEvent.click(screen.getByRole("radio", { name: "Boleto" }));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Boleto precisa do endereço");
    await userEvent.click(screen.getByRole("radio", { name: "Pix" }));
    await submit();

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.key).not.toBe(sent[0]?.key);
  });

  it("aReusedKeyAsksToCheckTheListAndKeepsTheKey", async () => {
    serveTheBasics();
    const sent = servePost(() =>
      HttpResponse.json(
        { type: "urn:gateway:IDEMPOTENCY_KEY_REUSED", status: 422 },
        { status: 422 },
      ),
    );
    renderForm();

    await fillPix();
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A tentativa anterior pode ter sido registrada. Confira antes de tentar de novo.",
    );
    await submit();
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.key).toBe(sent[0]?.key);
  });

  it("aNewSearchDropsTheCustomerChosenBefore", async () => {
    serveTheBasics();
    server.use(
      http.get(`${API}/customers`, ({ request }) =>
        new URL(request.url).searchParams.get("document") === "52998224725"
          ? HttpResponse.json([aCustomer()])
          : HttpResponse.json([aCustomer({ id: "cus_b", name: "Bruno Lima" })]),
      ),
    );
    const sent = servePost(() => created());
    renderForm();

    await fillPix();
    const search = screen.getByLabelText("Documento do cliente");
    await userEvent.clear(search);
    await userEvent.type(search, "11144477735");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText("Bruno Lima");
    await submit();

    expect(await screen.findByText("Escolha um cliente.")).toHaveAttribute("role", "alert");
    expect(sent).toHaveLength(0);
  });

  it("anUntouchedCardSelectBlocksTheSubmit", async () => {
    serveTheBasics([aSavedCard()]);
    const sent = servePost(() => created());
    renderForm();

    await chooseCustomer();
    await choosePlan();
    await userEvent.click(screen.getByRole("radio", { name: "Cartão" }));
    const card = await screen.findByLabelText("Cartão salvo");
    expect(card).toHaveValue("");
    await submit();

    expect(await screen.findByText("Escolha um cartão ou o link")).toBeInTheDocument();
    expect(card).toHaveAttribute("aria-invalid", "true");
    expect(sent).toHaveLength(0);
  });

  it("cardsThatFailToLoadBlockACardSubmit", async () => {
    serveTheBasics();
    server.use(
      http.get(`${API}/customers/:id/cards`, () =>
        HttpResponse.json({ type: "urn:gateway:INTERNAL" }, { status: 500 }),
      ),
    );
    const sent = servePost(() => created());
    renderForm();

    await chooseCustomer();
    await choosePlan();
    await userEvent.click(screen.getByRole("radio", { name: "Cartão" }));
    expect(
      await screen.findByText("Não foi possível carregar os cartões deste cliente."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Cartão salvo")).not.toBeInTheDocument();
    await submit();

    expect(sent).toHaveLength(0);
  });

  it("thePlanErrorDescribesTheSelect", async () => {
    serveTheBasics();
    renderForm();

    await submit();

    const plan = screen.getByLabelText("Plano");
    expect(plan).toHaveAttribute("aria-invalid", "true");
    expect(plan).toHaveAccessibleDescription("Escolha um plano.");
  });
});
