import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import { aMe, mockMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { PlansPage } from "./PlansPage";

const monthly = {
  id: "pl_1",
  name: "Mensal",
  amount: 4990,
  currency: "BRL",
  interval: "MONTH",
  interval_count: 1,
  trial_days: 7,
  active: true,
  created_at: "2026-10-01T12:00:00Z",
};
const old = { ...monthly, id: "pl_2", name: "Antigo", active: false, trial_days: 0 };

function renderPage(role: Role = "OWNER") {
  setAccessToken("gs_test");
  mockMe(aMe({ role }));
  return renderWithProviders([{ path: "/app/plans", element: <PlansPage /> }], {
    initialEntries: ["/app/plans"],
  });
}

describe("PlansPage", () => {
  it("listsPlansWithLabelsAndFiltersActiveOnes", async () => {
    const urls: string[] = [];
    server.use(
      http.get("http://localhost:8080/v1/plans", ({ request }) => {
        urls.push(new URL(request.url).search);
        return HttpResponse.json(request.url.includes("active=true") ? [monthly] : [monthly, old]);
      }),
    );
    renderPage();

    // The header row renders before the data: wait for a plan, not for a row.
    await screen.findByText("Mensal");
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText("R$ 49,90 / mês")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("7 dias")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Inativo")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Só ativos"));
    await vi.waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
    expect(urls).toContain("?active=true");
  });

  it("editsNameAndActiveOnly", async () => {
    let patched: unknown = null;
    server.use(
      http.get("http://localhost:8080/v1/plans", () => HttpResponse.json([monthly])),
      http.patch("http://localhost:8080/v1/plans/pl_1", async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...monthly, name: "Mensal Plus", active: false });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Editar Mensal" }));
    const dialog = screen.getByRole("dialog", { name: "Editar plano" });
    expect(within(dialog).queryByLabelText("Valor")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/não cancela assinaturas/)).toBeInTheDocument();

    const name = within(dialog).getByLabelText("Nome");
    await userEvent.clear(name);
    await userEvent.type(name, "Mensal Plus");
    await userEvent.click(within(dialog).getByLabelText("Ativo"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(patched).toEqual({ name: "Mensal Plus", active: false }));
  });

  it("opensTheCreateDialog", async () => {
    server.use(http.get("http://localhost:8080/v1/plans", () => HttpResponse.json([])));
    renderPage();

    expect(await screen.findByText("Nenhum plano por aqui.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Novo plano/ }));
    expect(screen.getByRole("dialog", { name: "Novo plano" })).toBeInTheDocument();
  });

  it("hidesNewAndEditFromReadonly", async () => {
    server.use(http.get("http://localhost:8080/v1/plans", () => HttpResponse.json([monthly])));
    renderPage("READONLY");

    await screen.findByText("Mensal");

    expect(screen.queryByRole("button", { name: /Novo plano/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Mensal" })).not.toBeInTheDocument();
  });

  it("showsNewAndEditToFinance", async () => {
    server.use(http.get("http://localhost:8080/v1/plans", () => HttpResponse.json([monthly])));
    renderPage("FINANCE");

    expect(await screen.findByRole("button", { name: /Novo plano/ })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Editar Mensal" })).toBeInTheDocument();
  });
});
