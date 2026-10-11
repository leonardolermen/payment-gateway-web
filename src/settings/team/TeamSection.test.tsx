import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../../auth/session";
import { aMe, mockMe } from "../../test/me";
import { server } from "../../test/msw/server";
import { renderWithProviders } from "../../test/render";
import { TeamSection } from "./TeamSection";

const API = "http://localhost:8080";

const team = {
  users: [
    {
      id: "u_1",
      name: "Ana Dona",
      email: "ana@loja.dev",
      role: "OWNER",
      last_login_at: "2026-10-09T12:00:00Z",
    },
    {
      id: "u_2",
      name: "Bruno Caixa",
      email: "bruno@loja.dev",
      role: "FINANCE",
      last_login_at: null,
    },
  ],
  invites: [{ email: "carla@loja.dev", role: "READONLY", expires_at: "2026-10-16T12:00:00Z" }],
};

const problem = (code: string, status: number) =>
  HttpResponse.json({ type: `urn:gateway:${code}`, status, detail: code }, { status });

function renderSection() {
  setAccessToken("gs_test");
  mockMe(aMe());
  server.use(http.get(`${API}/v1/merchant/users`, () => HttpResponse.json(team)));
  return renderWithProviders([{ path: "/", element: <TeamSection /> }]);
}

const rowOf = async (text: string) => (await screen.findByText(text)).closest("tr")!;

describe("TeamSection", () => {
  it("listsMembersAndPendingInvites", async () => {
    renderSection();

    const bruno = await rowOf("Bruno Caixa");
    expect(within(bruno).getByText("bruno@loja.dev")).toBeInTheDocument();
    expect(within(bruno).getByRole("combobox")).toHaveValue("FINANCE");
    const invite = await rowOf("carla@loja.dev");
    expect(within(invite).getByText("Leitura")).toBeInTheDocument();
  });

  it("locksTheCallersOwnRow", async () => {
    renderSection();

    const own = await rowOf("ana@loja.dev");
    await vi.waitFor(() => expect(within(own).getByRole("combobox")).toBeDisabled());
    expect(within(own).getByRole("combobox")).toHaveAttribute(
      "title",
      "Use Minha conta para a sua própria conta",
    );
    expect(within(own).queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
  });

  it("invitesAndConfirms", async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${API}/v1/invites`, async ({ request }) => {
        sent = await request.json();
        return new HttpResponse(null, { status: 202 });
      }),
    );
    renderSection();

    await screen.findByText("Bruno Caixa");
    await userEvent.type(screen.getByLabelText("E-mail"), "davi@loja.dev");
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "FINANCE");
    await userEvent.click(screen.getByRole("button", { name: "Convidar" }));

    expect(await screen.findByText("Convite enviado")).toBeInTheDocument();
    expect(sent).toEqual({ email: "davi@loja.dev", role: "FINANCE" });
  });

  it("showsATakenEmailOnTheEmailField", async () => {
    server.use(http.post(`${API}/v1/invites`, () => problem("EMAIL_TAKEN", 409)));
    renderSection();

    await screen.findByText("Bruno Caixa");
    await userEvent.type(screen.getByLabelText("E-mail"), "bruno@loja.dev");
    await userEvent.click(screen.getByRole("button", { name: "Convidar" }));

    await vi.waitFor(() =>
      expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription(
        "Este e-mail já tem conta.",
      ),
    );
  });

  it("changesARole", async () => {
    let sent: unknown = null;
    server.use(
      http.patch(`${API}/v1/merchant/users/u_2`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({});
      }),
    );
    renderSection();

    const bruno = await rowOf("Bruno Caixa");
    await userEvent.selectOptions(within(bruno).getByRole("combobox"), "READONLY");

    await vi.waitFor(() => expect(sent).toEqual({ role: "READONLY" }));
  });

  it("showsLastOwnerAsAnAlert", async () => {
    server.use(http.patch(`${API}/v1/merchant/users/u_2`, () => problem("LAST_OWNER", 409)));
    renderSection();

    const bruno = await rowOf("Bruno Caixa");
    await userEvent.selectOptions(within(bruno).getByRole("combobox"), "READONLY");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A loja precisa de pelo menos um dono.",
    );
  });

  it("removesAfterConfirmingByName", async () => {
    let removed = false;
    server.use(
      http.delete(`${API}/v1/merchant/users/u_2`, () => {
        removed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSection();

    const bruno = await rowOf("Bruno Caixa");
    await userEvent.click(within(bruno).getByRole("button", { name: "Remover" }));
    expect(removed).toBe(false);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Bruno Caixa");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remover" }));

    await vi.waitFor(() => expect(removed).toBe(true));
  });
});
