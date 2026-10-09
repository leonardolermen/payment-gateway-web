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
  const { pathname } = useLocation();

  return <div data-testid="where">{pathname}</div>;
}

const routes = [
  { path: "/login", element: <LoginPage /> },
  { path: "*", element: <Where /> },
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
    await userEvent.type(screen.getByLabelText("Senha"), "senha-unica-xyz");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByTestId("where");

    expect(JSON.stringify(window.localStorage)).not.toContain("senha-unica-xyz");
    expect(JSON.stringify(window.sessionStorage)).not.toContain("senha-unica-xyz");
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain("senha-unica-xyz");
    expect(router.state.location.search).not.toContain("senha");
    expect(screen.queryByDisplayValue("senha-unica-xyz")).not.toBeInTheDocument();
  });
});
