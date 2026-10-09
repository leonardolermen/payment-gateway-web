import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { RequireSession } from "./RequireSession";
import { clearSession, readAccessToken } from "./session";

function renderGuarded() {
  return renderWithProviders(
    [
      {
        path: "/app",
        element: <RequireSession />,
        children: [{ path: "orders", element: <p>Área logada</p> }],
      },
      { path: "/login", element: <p>Tela de login</p> },
    ],
    { initialEntries: ["/app/orders"] },
  );
}

function storagesHoldNoSessionToken(): boolean {
  const stored = [window.localStorage, window.sessionStorage].flatMap((storage) =>
    Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`),
  );

  return stored.every((entry) => !entry.includes("gs_"));
}

afterEach(() => clearSession());

describe("RequireSession", () => {
  it("restoresTheSessionFromTheRefreshCookieAndRendersTheOutlet", async () => {
    server.use(
      http.post("http://localhost:8080/v1/auth/refresh", () =>
        HttpResponse.json({ access_token: "gs_restored", expires_in: 900 }),
      ),
    );

    renderGuarded();

    expect(await screen.findByText("Área logada")).toBeInTheDocument();
    expect(readAccessToken()).toBe("gs_restored");
    expect(storagesHoldNoSessionToken()).toBe(true);
  });

  it("sendsToLoginWithTheNextPathWhenTheRefreshFails", async () => {
    server.use(
      http.post("http://localhost:8080/v1/auth/refresh", () =>
        HttpResponse.json({ status: 401 }, { status: 401 }),
      ),
    );

    const { router } = renderGuarded();

    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe(
      "/login?next=%2Fapp%2Forders",
    );
    expect(storagesHoldNoSessionToken()).toBe(true);
  });
});
