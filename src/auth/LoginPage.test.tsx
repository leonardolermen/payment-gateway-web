import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { LoginPage } from "./LoginPage";
import { clearSession } from "./session";

const API = "http://localhost:8080";

function Where() {
  const location = useLocation();

  return <div data-testid="where">{location.pathname + location.search}</div>;
}

const routes = [
  { path: "/login", element: <LoginPage /> },
  { path: "*", element: <Where /> },
];

function answerLogin(response: () => Response) {
  server.use(http.post(`${API}/v1/auth/login`, response));
}

function opened() {
  return HttpResponse.json({ access_token: "gs_x", expires_in: 900 });
}

async function signIn(entry: string) {
  renderWithProviders(routes, { initialEntries: [entry] });
  await userEvent.type(screen.getByLabelText("E-mail"), "ana@loja.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-correta-1");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

afterEach(() => clearSession());

describe("LoginPage", () => {
  it("landsOnTheOrdersByDefault", async () => {
    answerLogin(opened);

    await signIn("/login");

    expect(await screen.findByTestId("where")).toHaveTextContent("/app/orders");
  });

  it("honoursASameOriginNext", async () => {
    answerLogin(opened);

    await signIn("/login?next=%2Fapp%2Fplans%3Fpage%3D2");

    expect(await screen.findByTestId("where")).toHaveTextContent("/app/plans?page=2");
  });

  it("ignoresAProtocolRelativeNext", async () => {
    answerLogin(opened);

    await signIn("/login?next=//evil.com");

    expect(await screen.findByTestId("where")).toHaveTextContent("/app/orders");
  });

  it("saysTheCredentialsAreWrongAndClearsThePassword", async () => {
    answerLogin(() =>
      HttpResponse.json(
        { type: "urn:gateway:INVALID_CREDENTIALS", status: 401, detail: "bad" },
        { status: 401 },
      ),
    );

    await signIn("/login");

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Esqueci a senha" })).toHaveAttribute(
      "href",
      "/forgot",
    );
  });
});
