import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { ResetPage } from "./ResetPage";

const API = "http://localhost:8080";

function openReset() {
  renderWithProviders([{ path: "/reset/:token", element: <ResetPage /> }], {
    initialEntries: ["/reset/tok_reset"],
  });
}

async function choose(password: string, confirmation: string) {
  await userEvent.type(screen.getByLabelText("Nova senha"), password);
  await userEvent.type(screen.getByLabelText("Confirmar senha"), confirmation);
  await userEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));
}

describe("ResetPage", () => {
  it("refusesMismatchedPasswordsWithoutCallingTheGateway", async () => {
    let called = false;
    server.use(
      http.post(`${API}/v1/auth/password/reset`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    openReset();

    await choose("senha-longa-123", "senha-longa-124");

    expect(await screen.findByText("As senhas não conferem")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("sendsTheTokenAndConfirmsTheReset", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/v1/auth/password/reset`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    openReset();

    await choose("senha-longa-123", "senha-longa-123");

    expect(await screen.findByText("Senha redefinida.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(body).toEqual({ token: "tok_reset", password: "senha-longa-123" });
  });

  it("offersANewLinkWhenTheTokenExpired", async () => {
    server.use(
      http.post(`${API}/v1/auth/password/reset`, () =>
        HttpResponse.json(
          { type: "urn:gateway:TOKEN_EXPIRED", status: 410, detail: "gone" },
          { status: 410 },
        ),
      ),
    );
    openReset();

    await choose("senha-longa-123", "senha-longa-123");

    expect(await screen.findByText("Este link não vale mais.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir outro link" })).toHaveAttribute(
      "href",
      "/forgot",
    );
  });
});
