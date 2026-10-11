import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import { server } from "../test/msw/server";
import { serverError, withTheGatewayKeyRule } from "../test/idempotency";
import { renderWithProviders } from "../test/render";
import { PlanForm } from "./PlanForm";

const created = {
  id: "pl_1",
  name: "Mensal",
  amount: 4990,
  currency: "BRL",
  interval: "MONTH",
  interval_count: 1,
  trial_days: 0,
  active: true,
  created_at: "2026-10-08T10:00:00Z",
};

function renderForm(onCreated = vi.fn()) {
  setAccessToken("gs_test");
  renderWithProviders([
    { path: "/", element: <PlanForm onCreated={onCreated} onCancel={() => {}} /> },
  ]);
  return onCreated;
}

describe("PlanForm", () => {
  it("sendsCentsAndRefusesEmptyNameAndZeroCount", async () => {
    const bodies: unknown[] = [];
    const keys: (string | null)[] = [];
    server.use(
      http.post("http://localhost:8080/v1/plans", async ({ request }) => {
        bodies.push(await request.json());
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const onCreated = renderForm();

    await userEvent.type(screen.getByLabelText("Valor"), "49,90");
    await userEvent.clear(screen.getByLabelText("A cada"));
    await userEvent.type(screen.getByLabelText("A cada"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));

    expect(await screen.findByText("Informe o nome.")).toBeInTheDocument();
    expect(screen.getByText("Pelo menos 1.")).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    await userEvent.type(screen.getByLabelText("Nome"), "Mensal");
    await userEvent.clear(screen.getByLabelText("A cada"));
    await userEvent.type(screen.getByLabelText("A cada"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(bodies[0]).toEqual({
      name: "Mensal",
      amount: 4990,
      currency: "BRL",
      interval: "MONTH",
      interval_count: 1,
      trial_days: 0,
    });
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("anUncertainFailureKeepsTheKeyUntilTheOperatorStartsOver", async () => {
    const keys: (string | null)[] = [];
    const answer = withTheGatewayKeyRule(() => serverError());
    server.use(
      http.post("http://localhost:8080/v1/plans", ({ request }) => {
        const key = request.headers.get("Idempotency-Key");
        keys.push(key);
        return answer(key);
      }),
    );
    renderForm();

    await userEvent.type(screen.getByLabelText("Nome"), "A");
    await userEvent.type(screen.getByLabelText("Valor"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));

    // Same intent, same key: a retry after a failure must replay, not duplicate.
    await vi.waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).toBe(keys[0]);

    await userEvent.click(await screen.findByRole("button", { name: "Recomeçar" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));
    await vi.waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("aRefusalThenAFixSendsANewKey", async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post("http://localhost:8080/v1/plans", ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return keys.length === 1
          ? HttpResponse.json(
              { type: "urn:gateway:INVALID_REQUEST", status: 400, detail: "x" },
              { status: 400 },
            )
          : HttpResponse.json(created, { status: 201 });
      }),
    );
    const onCreated = renderForm();

    await userEvent.type(screen.getByLabelText("Nome"), "A");
    await userEvent.type(screen.getByLabelText("Valor"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Requisição inválida.");
    await userEvent.type(screen.getByLabelText("Nome"), "B");
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(keys[1]).not.toBe(keys[0]);
  });
});
