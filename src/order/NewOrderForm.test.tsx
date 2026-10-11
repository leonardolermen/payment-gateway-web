import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../auth/session";
import { anOrder } from "../test/fixtures/orders";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { NewOrderForm } from "./NewOrderForm";

const ORDERS = "http://localhost:8080/v1/orders";

function renderPage() {
  setAccessToken("gs_test");
  return renderWithProviders(
    [
      { path: "/app/orders", element: <NewOrderForm /> },
      { path: "/app/orders/:id", element: <div>detalhe</div> },
    ],
    { initialEntries: ["/app/orders"] },
  );
}

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText("Valor"), "49,90");
  await userEvent.click(screen.getByRole("radio", { name: "Novo" }));
  await userEvent.type(screen.getByLabelText("Nome"), "Ana Lima");
  await userEvent.type(screen.getByLabelText("Documento"), "12345678909");
}

describe("NewOrderForm", () => {
  it("sendsCentsAndAStableIdempotencyKeyOnDoubleClick", async () => {
    const keys: (string | null)[] = [];
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(ORDERS, async ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ type: "urn:gateway:INTERNAL" }, { status: 500 });
      }),
    );
    renderPage();
    await fillValidForm();

    const submit = screen.getByRole("button", { name: "Criar cobrança" });
    await userEvent.click(submit);
    await screen.findByRole("alert");
    // The retry after a failure is the case the key exists for.
    await userEvent.click(submit);
    await waitFor(() => expect(keys).toHaveLength(2));

    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(bodies[0]).toHaveProperty("customer");
    expect(bodies[0]).not.toHaveProperty("customer_id");
    expect(bodies[0]).toMatchObject({
      amount: 4990,
      currency: "BRL",
      customer: { name: "Ana Lima", document: "12345678909" },
    });
  });

  it("refusesAnEmptyAmountBeforeTheRequest", async () => {
    let requests = 0;
    server.use(
      http.post(ORDERS, () => {
        requests += 1;
        return HttpResponse.json(anOrder(), { status: 201 });
      }),
    );
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Criar cobrança" }));

    expect(await screen.findByText("Informe um valor válido.")).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it("refusesASubmitWithoutACustomer", async () => {
    let requests = 0;
    server.use(
      http.post(ORDERS, () => {
        requests += 1;
        return HttpResponse.json(anOrder(), { status: 201 });
      }),
    );
    renderPage();

    await userEvent.type(screen.getByLabelText("Valor"), "49,90");
    await userEvent.click(screen.getByRole("button", { name: "Criar cobrança" }));

    expect(await screen.findByText("Escolha ou informe um cliente.")).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it("navigatesToTheDetailWithTheCheckoutUrl", async () => {
    server.use(
      http.post(ORDERS, () =>
        HttpResponse.json(anOrder({ id: "ord_00000007", checkout_url: "http://pay/abc" }), {
          status: 201,
        }),
      ),
    );
    const { router } = renderPage();
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Criar cobrança" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/app/orders/ord_00000007"));
    expect(router.state.location.state).toEqual({ checkoutUrl: "http://pay/abc" });
  });
});

describe("NewOrderForm matches the approved mockup", () => {
  it("usesSmallCapsLabelsTallInputsAndADisplayAmount", () => {
    renderPage();

    const amount = screen.getByLabelText("Valor");
    expect(amount).toHaveClass("font-display", "text-[22px]", "bg-field");
    expect(screen.getByLabelText("Descrição")).toHaveClass("h-10", "border-line");
    expect(screen.getByText("Descrição", { selector: "label" })).toHaveClass(
      "text-[10px]",
      "uppercase",
    );
    expect(screen.getByPlaceholderText("Buscar por CPF…")).toBeInTheDocument();
    expect(amount.closest(".rounded-card")).not.toBeNull();
  });
});
