import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import { aCustomer } from "../test/fixtures/customers";
import { anOrder } from "../test/fixtures/orders";
import { aSubscription } from "../test/fixtures/subscriptions";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import type { Order } from "../order/types";
import type { Subscription } from "../subscription/types";
import { CustomerDetailPage } from "./CustomerDetailPage";
import type { Customer } from "./types";

const API = "http://localhost:8080/v1";

type Mocks = {
  customer?: Customer;
  orders?: Order[];
  subscriptions?: Subscription[];
  searches?: { orders: string[]; subscriptions: string[] };
};

function renderDetail(role: Role = "OWNER", mocks: Mocks = {}) {
  setAccessToken("gs_test");
  server.use(
    http.get(`${API}/customers/cus_00000001`, () =>
      HttpResponse.json(mocks.customer ?? aCustomer()),
    ),
    http.get(`${API}/customers/cus_00000001/cards`, () => HttpResponse.json([])),
    http.get(`${API}/orders`, ({ request }) => {
      mocks.searches?.orders.push(new URL(request.url).search);
      return HttpResponse.json(mocks.orders ?? []);
    }),
    http.get(`${API}/subscriptions`, ({ request }) => {
      mocks.searches?.subscriptions.push(new URL(request.url).search);
      return HttpResponse.json(mocks.subscriptions ?? []);
    }),
  );

  return renderWithProviders([{ path: "/app/customers/:id", element: <CustomerDetailPage /> }], {
    initialEntries: ["/app/customers/cus_00000001"],
    me: aMe({ role }),
  });
}

describe("CustomerDetailPage", () => {
  it("showsTheCustomerData", async () => {
    renderDetail("OWNER", {
      customer: aCustomer({
        address: {
          street: "Rua das Flores, 10",
          district: "Centro",
          city: "Curitiba",
          state: "PR",
          zip: "80010000",
        },
      }),
    });

    expect(await screen.findByRole("heading", { name: "Maria Souza" })).toBeInTheDocument();
    expect(screen.getByText("***.982.247-**")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Rua das Flores, 10/)).toHaveTextContent(
      "Rua das Flores, 10 · Centro · Curitiba/PR · CEP 80010-000",
    );
  });

  it("showsADashForMissingEmailAndAddress", async () => {
    renderDetail("OWNER", { customer: aCustomer({ email: null, address: null }) });

    await screen.findByRole("heading", { name: "Maria Souza" });
    const data = screen.getByRole("region", { name: "Dados" });

    expect(within(data).getAllByText("—")).toHaveLength(2);
  });

  it("historyListsOrdersAndSubscriptionsOfThisCustomer", async () => {
    const searches = { orders: [] as string[], subscriptions: [] as string[] };
    renderDetail("OWNER", {
      orders: [anOrder({ id: "ord_00000007", amount: 4990, status: "PAID" })],
      subscriptions: [aSubscription({ id: "sub_00000003", status: "PAST_DUE" })],
      searches,
    });

    const orders = await screen.findByRole("region", { name: "Cobranças" });
    const orderLink = await within(orders).findByRole("link", { name: /06\/10\/2026/ });
    expect(orderLink).toHaveAttribute("href", "/app/orders/ord_00000007");
    expect(within(orders).getByText("R$ 49,90")).toBeInTheDocument();
    expect(within(orders).getByText("Paga")).toBeInTheDocument();

    const subscriptions = screen.getByRole("region", { name: "Assinaturas" });
    const subscriptionLink = await within(subscriptions).findByRole("link", {
      name: /06\/10\/2026/,
    });
    expect(subscriptionLink).toHaveAttribute("href", "/app/subscriptions/sub_00000003");
    expect(within(subscriptions).getByText("Em atraso")).toBeInTheDocument();

    expect(new URLSearchParams(searches.orders.at(-1)).get("customer_id")).toBe("cus_00000001");
    expect(new URLSearchParams(searches.subscriptions.at(-1)).get("customer_id")).toBe(
      "cus_00000001",
    );
  });

  it("historySaysWhenThereIsNothingYet", async () => {
    renderDetail();

    expect(await screen.findByText("Nenhuma cobrança deste cliente.")).toBeInTheDocument();
    expect(await screen.findByText("Nenhuma assinatura deste cliente.")).toBeInTheDocument();
  });

  it("newChargeLinksToTheOrdersFormForFinance", async () => {
    renderDetail("FINANCE");

    expect(await screen.findByRole("link", { name: "Nova cobrança" })).toHaveAttribute(
      "href",
      "/app/orders?customer_id=cus_00000001",
    );
  });

  it("hidesNewChargeFromReadonly", async () => {
    renderDetail("READONLY");

    await screen.findByRole("heading", { name: "Maria Souza" });

    expect(screen.queryByRole("link", { name: "Nova cobrança" })).not.toBeInTheDocument();
  });

  it("saysWhenTheCustomerDoesNotExist", async () => {
    setAccessToken("gs_test");
    server.use(
      http.get(`${API}/customers/cus_00000001`, () =>
        HttpResponse.json(
          { type: "urn:gateway:NOT_FOUND", status: 404, detail: "customer not found" },
          { status: 404 },
        ),
      ),
    );

    renderWithProviders([{ path: "/app/customers/:id", element: <CustomerDetailPage /> }], {
      initialEntries: ["/app/customers/cus_00000001"],
      me: aMe(),
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não encontrado.");
  });
});
