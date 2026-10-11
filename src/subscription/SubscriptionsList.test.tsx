import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import { aPlan } from "../test/fixtures/plans";
import { aSubscription } from "../test/fixtures/subscriptions";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { SubscriptionsList } from "./SubscriptionsList";
import type { Subscription } from "./types";

const API = "http://localhost:8080/v1";
const SUBSCRIPTIONS = `${API}/subscriptions`;

function servePlans() {
  const planGets: string[] = [];
  server.use(
    http.get(`${API}/plans/:id`, ({ params }) => {
      const id = String(params.id);
      planGets.push(id);
      return HttpResponse.json(aPlan({ id, name: id === "plan_anual" ? "Anual" : "Mensal Pro" }));
    }),
  );
  return planGets;
}

function serveSubscriptions(answer: (search: URLSearchParams) => Subscription[]) {
  const searches: URLSearchParams[] = [];
  server.use(
    http.get(SUBSCRIPTIONS, ({ request }) => {
      const search = new URL(request.url).searchParams;
      searches.push(search);
      return HttpResponse.json(answer(search));
    }),
  );
  return searches;
}

function renderList() {
  setAccessToken("gs_test");
  return renderWithProviders(
    [
      { path: "/app/subscriptions", element: <SubscriptionsList /> },
      { path: "/app/subscriptions/:id", element: <SubscriptionsList /> },
    ],
    { initialEntries: ["/app/subscriptions"], me: aMe({ role: "OWNER" }) },
  );
}

function rowWith(text: string): HTMLElement {
  const row = screen.getByText(text).closest("tr");
  if (!row) {
    throw new Error(`no row with ${text}`);
  }
  return row;
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

afterEach(() => {
  vi.useRealTimers();
  setVisibility("visible");
});

describe("SubscriptionsList", () => {
  it("showsCustomerPlanMethodStatusAndNextBilling", async () => {
    servePlans();
    serveSubscriptions(() => [
      aSubscription({ id: "sub_a", method: "PIX", status: "ACTIVE" }),
      aSubscription({
        id: "sub_b",
        customer_id: "cus_gone",
        customer_name: null,
        plan_id: "plan_anual",
        method: "CARD",
        status: "PAST_DUE",
        next_billing_at: null,
      }),
    ]);

    renderList();

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Cliente",
      "Plano",
      "Método",
      "Status",
      "Próxima cobrança",
    ]);
    const active = rowWith("Maria Souza");
    const pastDue = rowWith("cus_gone");
    expect(await within(active).findByText("Mensal Pro")).toBeInTheDocument();
    expect(active).toHaveTextContent("Pix");
    expect(within(active).getByText("Ativa")).toHaveClass("bg-ok-bg");
    expect(active).toHaveTextContent("06/11/2026, 09:00");

    // A deleted customer keeps only the id; a subscription between cycles has no next billing.
    expect(pastDue).toHaveTextContent("cus_gone");
    expect(await within(pastDue).findByText("Anual")).toBeInTheDocument();
    expect(pastDue).toHaveTextContent("Cartão");
    expect(within(pastDue).getByText("Em atraso")).toHaveClass("bg-warn-bg");
    expect(pastDue).toHaveTextContent("—");
  });

  it("fetchesEachPlanOnceHoweverManyRowsShareIt", async () => {
    const planGets = servePlans();
    serveSubscriptions(() => [
      aSubscription({ id: "sub_a" }),
      aSubscription({ id: "sub_b" }),
      aSubscription({ id: "sub_c", plan_id: "plan_anual" }),
    ]);

    renderList();

    expect(await screen.findAllByText("Mensal Pro")).toHaveLength(2);
    expect(await screen.findByText("Anual")).toBeInTheDocument();
    expect(planGets.sort()).toEqual(["plan_00000001", "plan_anual"]);
  });

  it("rowsLinkToTheSubscription", async () => {
    servePlans();
    serveSubscriptions(() => [aSubscription({ id: "sub_a" })]);
    const { router } = renderList();

    const link = await screen.findByRole("link", { name: "Maria Souza" });
    expect(link).toHaveAttribute("href", "/app/subscriptions/sub_a");

    await userEvent.click(screen.getByText("Pix"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/subscriptions/sub_a"));
    expect(screen.getAllByRole("row")[1]).toHaveAttribute("data-selected", "true");
  });

  it("statusFilterIsSentToTheApi", async () => {
    servePlans();
    const searches = serveSubscriptions(() => []);
    renderList();

    const filter = await screen.findByLabelText("Status");
    expect(
      within(filter)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Todas", "Ativas", "Em atraso", "Incompletas", "Canceladas", "Encerradas"]);

    await userEvent.selectOptions(filter, "Em atraso");
    await waitFor(() => expect(searches.at(-1)?.get("status")).toBe("PAST_DUE"));

    await userEvent.selectOptions(filter, "Todas");
    await waitFor(() => expect(searches.at(-1)?.has("status")).toBe(false));
    expect(searches[0]?.has("status")).toBe(false);
  });

  // The gateway may file an expired first payment under ENDED; the list shows whatever it answers.
  it("endedAlsoShowsExpiredIncompleteRows", async () => {
    servePlans();
    serveSubscriptions((search) =>
      search.get("status") === "ENDED"
        ? [
            aSubscription({ id: "sub_ended", status: "ENDED" }),
            aSubscription({ id: "sub_expired", status: "INCOMPLETE_EXPIRED" }),
          ]
        : [],
    );
    renderList();

    await userEvent.selectOptions(await screen.findByLabelText("Status"), "Encerradas");

    expect(await screen.findByText("Encerrada")).toBeInTheDocument();
    expect(screen.getByText("Expirada")).toHaveClass("bg-neutral-bg");
  });

  it("loadMoreRequestsTheNextCursor", async () => {
    servePlans();
    const page = Array.from({ length: 20 }, (_, index) =>
      aSubscription({ id: `sub_${String(index).padStart(2, "0")}` }),
    );
    const searches = serveSubscriptions((search) => (search.get("cursor") ? [] : page));
    renderList();

    await userEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));

    await waitFor(() =>
      expect(searches.map((search) => search.get("cursor"))).toEqual([null, "sub_19"]),
    );
    expect(searches[0]?.get("limit")).toBe("20");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument(),
    );
  });

  it("saysWhenThereIsNothingAndWhenTheListFails", async () => {
    servePlans();
    serveSubscriptions(() => []);
    renderList();

    expect(await screen.findByText("Nenhuma assinatura por aqui.")).toBeInTheDocument();

    server.use(
      http.get(SUBSCRIPTIONS, () =>
        HttpResponse.json({ type: "urn:gateway:INTERNAL" }, { status: 500 }),
      ),
    );
    await userEvent.selectOptions(screen.getByLabelText("Status"), "Ativas");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as assinaturas.",
    );
  });

  it("pollsEveryTenSecondsOnlyWhileTheTabIsVisible", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    servePlans();
    const searches = serveSubscriptions(() => [aSubscription()]);
    renderList();
    await screen.findByText("Maria Souza");
    expect(searches).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() => expect(searches).toHaveLength(2));

    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(searches).toHaveLength(2);
  });
});
