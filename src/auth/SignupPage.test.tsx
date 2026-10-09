import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { clearSession } from "./session";
import { SignupPage } from "./SignupPage";

const API = "http://localhost:8080";

function problem(code: string, status: number) {
  return HttpResponse.json({ type: `urn:gateway:${code}`, status, detail: code }, { status });
}

async function signUp(response: () => Response) {
  server.use(http.post(`${API}/v1/auth/signup`, response));
  renderWithProviders(
    [
      { path: "/signup", element: <SignupPage /> },
      { path: "/app/orders", element: <p>Pedidos</p> },
    ],
    { initialEntries: ["/signup"] },
  );
  await userEvent.type(screen.getByLabelText("Nome da loja"), "Loja da Ana");
  await userEvent.type(screen.getByLabelText("Seu nome"), "Ana");
  await userEvent.type(screen.getByLabelText("E-mail"), "ana@loja.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-longa-123");
  await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
}

afterEach(() => clearSession());

describe("SignupPage", () => {
  it("landsOnTheOrdersAfterCreatingTheAccount", async () => {
    await signUp(() =>
      HttpResponse.json({ access_token: "gs_x", expires_in: 900 }, { status: 201 }),
    );

    expect(await screen.findByText("Pedidos")).toBeInTheDocument();
  });

  it("putsATakenEmailOnTheEmailField", async () => {
    await signUp(() => problem("EMAIL_TAKEN", 409));

    expect(await screen.findByText("Este e-mail já tem conta.")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("putsAWeakPasswordOnThePasswordField", async () => {
    await signUp(() => problem("WEAK_PASSWORD", 422));

    expect(
      await screen.findByText("A senha precisa ter pelo menos 10 caracteres."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
  });
});
