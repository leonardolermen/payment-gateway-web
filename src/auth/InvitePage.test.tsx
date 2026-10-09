import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { InvitePage } from "./InvitePage";
import { clearSession } from "./session";

const API = "http://localhost:8080";

function problem(code: string, status: number) {
  return HttpResponse.json({ type: `urn:gateway:${code}`, status, detail: code }, { status });
}

async function accept(response: () => Response) {
  server.use(http.post(`${API}/v1/auth/invite/accept`, response));
  renderWithProviders(
    [
      { path: "/invite/:token", element: <InvitePage /> },
      { path: "/app/orders", element: <p>Pedidos</p> },
    ],
    { initialEntries: ["/invite/tok_invite"] },
  );
  await userEvent.type(screen.getByLabelText("Seu nome"), "Bruno");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-longa-123");
  await userEvent.click(screen.getByRole("button", { name: "Aceitar convite" }));
}

afterEach(() => clearSession());

describe("InvitePage", () => {
  it("landsOnTheOrdersAfterAccepting", async () => {
    await accept(() =>
      HttpResponse.json({ access_token: "gs_x", expires_in: 900 }, { status: 201 }),
    );

    expect(await screen.findByText("Pedidos")).toBeInTheDocument();
  });

  it("explainsAnExpiredInvite", async () => {
    await accept(() => problem("TOKEN_EXPIRED", 410));

    expect(
      await screen.findByText("Convite expirado — peça um novo ao dono da loja."),
    ).toBeInTheDocument();
  });

  it("sendsAnExistingAccountToTheLogin", async () => {
    await accept(() => problem("EMAIL_TAKEN", 409));

    expect(await screen.findByText("Este e-mail já tem conta: entre com ela.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });
});
