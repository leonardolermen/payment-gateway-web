import type { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { InvitePage } from "./InvitePage";
import { LoginPage } from "./LoginPage";
import { ResetPage } from "./ResetPage";
import { clearSession } from "./session";
import { SignupPage } from "./SignupPage";

const API = "http://localhost:8080";
const PASSWORD = "senha-unica-xyz";

function Where() {
  const { pathname } = useLocation();

  return <div data-testid="where">{pathname}</div>;
}

const routes = [
  { path: "/login", element: <LoginPage /> },
  { path: "*", element: <Where /> },
];

function problem(code: string, status: number) {
  return HttpResponse.json({ type: `urn:gateway:${code}`, status, detail: code }, { status });
}

function expectPasswordNowhere(queryClient: QueryClient, search: string) {
  expect(JSON.stringify(window.localStorage)).not.toContain(PASSWORD);
  expect(JSON.stringify(window.sessionStorage)).not.toContain(PASSWORD);
  expect(
    JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
    ),
  ).not.toContain(PASSWORD);
  expect(search).not.toContain("senha");
  expect(screen.queryByDisplayValue(PASSWORD)).not.toBeInTheDocument();
}

type FailingForm = {
  name: string;
  path: string;
  entry: string;
  page: ReactNode;
  endpoint: string;
  response: () => Response;
  fill: () => Promise<void>;
  submit: string;
  shown: string;
};

const FAILING_FORMS: FailingForm[] = [
  {
    name: "login 401",
    path: "/login",
    entry: "/login",
    page: <LoginPage />,
    endpoint: "/v1/auth/login",
    response: () => problem("INVALID_CREDENTIALS", 401),
    fill: async () => {
      await userEvent.type(screen.getByLabelText("E-mail"), "ana@loja.com");
      await userEvent.type(screen.getByLabelText("Senha"), PASSWORD);
    },
    submit: "Entrar",
    shown: "E-mail ou senha incorretos.",
  },
  {
    name: "signup 422",
    path: "/signup",
    entry: "/signup",
    page: <SignupPage />,
    endpoint: "/v1/auth/signup",
    response: () => problem("WEAK_PASSWORD", 422),
    fill: async () => {
      await userEvent.type(screen.getByLabelText("Nome da loja"), "Loja da Ana");
      await userEvent.type(screen.getByLabelText("Seu nome"), "Ana");
      await userEvent.type(screen.getByLabelText("E-mail"), "ana@loja.com");
      await userEvent.type(screen.getByLabelText("Senha"), PASSWORD);
    },
    submit: "Criar conta",
    shown: "A senha precisa ter pelo menos 10 caracteres.",
  },
  {
    name: "reset 410",
    path: "/reset/:token",
    entry: "/reset/tok_reset",
    page: <ResetPage />,
    endpoint: "/v1/auth/password/reset",
    response: () => problem("TOKEN_EXPIRED", 410),
    fill: async () => {
      await userEvent.type(screen.getByLabelText("Nova senha"), PASSWORD);
      await userEvent.type(screen.getByLabelText("Confirmar senha"), PASSWORD);
    },
    submit: "Redefinir senha",
    shown: "Este link não vale mais.",
  },
  {
    name: "invite 409",
    path: "/invite/:token",
    entry: "/invite/tok_invite",
    page: <InvitePage />,
    endpoint: "/v1/auth/invite/accept",
    response: () => problem("EMAIL_TAKEN", 409),
    fill: async () => {
      await userEvent.type(screen.getByLabelText("Seu nome"), "Bruno");
      await userEvent.type(screen.getByLabelText("Senha"), PASSWORD);
    },
    submit: "Aceitar convite",
    shown: "Este e-mail já tem conta: entre com ela.",
  },
];

afterEach(() => clearSession());

describe("passwords", () => {
  it("noPasswordSurvivesTheRequestOrReachesStorageOrTheUrl", async () => {
    server.use(
      http.post(`${API}/v1/auth/login`, () =>
        HttpResponse.json({ access_token: "gs_x", expires_in: 900 }),
      ),
    );
    const { queryClient, router } = renderWithProviders(routes, { initialEntries: ["/login"] });
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@loja.com");
    await userEvent.type(screen.getByLabelText("Senha"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByTestId("where");

    expectPasswordNowhere(queryClient, router.state.location.search);
  });

  it.each(FAILING_FORMS)("noPasswordSurvivesAFailed $name", async (form) => {
    server.use(http.post(`${API}${form.endpoint}`, form.response));
    const { queryClient, router } = renderWithProviders([{ path: form.path, element: form.page }], {
      initialEntries: [form.entry],
    });
    await form.fill();
    await userEvent.click(screen.getByRole("button", { name: form.submit }));
    await screen.findByText(form.shown, { exact: false });

    expectPasswordNowhere(queryClient, router.state.location.search);
  });
});
