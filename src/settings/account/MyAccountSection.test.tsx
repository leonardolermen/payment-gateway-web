import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../../auth/session";
import { aMe, mockMe } from "../../test/me";
import { server } from "../../test/msw/server";
import { renderWithProviders } from "../../test/render";
import { MyAccountSection } from "./MyAccountSection";

const API = "http://localhost:8080";

const sessions = [
  {
    id: "s_1",
    ip: "10.0.0.1",
    user_agent: "Firefox no Linux",
    created_at: "2026-10-01T12:00:00Z",
    last_used_at: "2026-10-09T12:00:00Z",
    current: true,
  },
  {
    id: "s_2",
    ip: "10.0.0.2",
    user_agent: null,
    created_at: "2026-09-01T12:00:00Z",
    last_used_at: "2026-09-02T12:00:00Z",
    current: false,
  },
];

const problem = (code: string, status: number) =>
  HttpResponse.json({ type: `urn:gateway:${code}`, status, detail: code }, { status });

function renderSection() {
  setAccessToken("gs_test");
  mockMe(aMe());
  server.use(http.get(`${API}/v1/me/sessions`, () => HttpResponse.json(sessions)));
  return renderWithProviders([{ path: "/", element: <MyAccountSection /> }]);
}

async function fillPassword(current: string, next: string, confirmation: string) {
  await userEvent.type(screen.getByLabelText("Senha atual"), current);
  await userEvent.type(screen.getByLabelText("Nova senha"), next);
  await userEvent.type(screen.getByLabelText("Confirmar nova senha"), confirmation);
  await userEvent.click(screen.getByRole("button", { name: "Alterar senha" }));
}

describe("MyAccountSection", () => {
  it("renamesAndRefreshesMe", async () => {
    let sent: unknown = null;
    server.use(
      http.patch(`${API}/v1/me`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({});
      }),
    );
    const { queryClient } = renderSection();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const name = await screen.findByLabelText("Nome");
    await vi.waitFor(() => expect(name).toHaveValue("Ana Dona"));
    await userEvent.clear(name);
    await userEvent.type(name, "Ana Souza");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Nome atualizado.")).toBeInTheDocument();
    expect(sent).toEqual({ name: "Ana Souza" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me"] });
  });

  it("refusesMismatchedPasswordsWithoutCallingTheApi", async () => {
    let called = false;
    server.use(
      http.post(`${API}/v1/me/password`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSection();

    await fillPassword("antiga-senha-1", "nova-senha-123", "outra-senha-123");

    expect(await screen.findByText("As senhas não conferem")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("showsAWrongCurrentPasswordUnderSenhaAtual", async () => {
    server.use(http.post(`${API}/v1/me/password`, () => problem("INVALID_CREDENTIALS", 401)));
    renderSection();

    await fillPassword("errada-errada", "nova-senha-123", "nova-senha-123");

    const current = screen.getByLabelText("Senha atual");
    await vi.waitFor(() => expect(current).toHaveAttribute("aria-invalid", "true"));
    expect(current).toHaveAccessibleDescription("Senha atual incorreta.");
    expect(current).toHaveValue("");
  });

  it("showsAWeakPasswordUnderNovaSenha", async () => {
    server.use(http.post(`${API}/v1/me/password`, () => problem("WEAK_PASSWORD", 422)));
    renderSection();

    await fillPassword("antiga-senha-1", "curta", "curta");

    await vi.waitFor(() =>
      expect(screen.getByLabelText("Nova senha")).toHaveAccessibleDescription(
        "A senha precisa ter pelo menos 10 caracteres.",
      ),
    );
  });

  it("changesThePasswordAndClearsTheForm", async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${API}/v1/me/password`, async ({ request }) => {
        sent = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSection();

    await fillPassword("antiga-senha-1", "nova-senha-123", "nova-senha-123");

    expect(
      await screen.findByText("Senha alterada; as outras sessões foram encerradas."),
    ).toBeInTheDocument();
    expect(sent).toEqual({ current: "antiga-senha-1", new: "nova-senha-123" });
    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveValue("");
  });

  it("listsSessionsAndMarksTheCurrentOne", async () => {
    renderSection();

    const current = (await screen.findByText("Firefox no Linux")).closest("tr")!;
    expect(within(current).getByText("atual")).toBeInTheDocument();
    const other = screen.getByText("10.0.0.2").closest("tr")!;
    expect(within(other).getByText("—")).toBeInTheDocument();
    expect(within(other).queryByText("atual")).not.toBeInTheDocument();
  });

  it("revokesTheOtherSessionsAfterConfirming", async () => {
    let revoked = false;
    server.use(
      http.delete(`${API}/v1/me/sessions/others`, () => {
        revoked = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSection();

    await screen.findByText("Firefox no Linux");
    await userEvent.click(screen.getByRole("button", { name: "Encerrar as outras sessões" }));
    expect(revoked).toBe(false);
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Encerrar" }));

    await vi.waitFor(() => expect(revoked).toBe(true));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
