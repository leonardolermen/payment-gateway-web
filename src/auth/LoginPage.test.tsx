import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import { server } from "../test/msw/server";
import { KEY } from "./apiKey";
import { LoginPage } from "./LoginPage";

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

const routes = [
  { path: "/app/login", element: <LoginPage /> },
  { path: "*", element: <Where /> },
];

const merchant = { merchant_id: "m1", name: "Loja", environment: "TEST" };

async function logIn(key: string) {
  await userEvent.type(screen.getByLabelText("Chave de API"), key);
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("LoginPage", () => {
  it("aKeyPastedWithWhitespaceStillLogsIn", async () => {
    let authorization: string | null = null;
    server.use(
      http.get("http://localhost:8080/v1/merchant", ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json(merchant);
      }),
    );
    renderWithProviders(routes, { initialEntries: ["/app/login"] });

    await logIn("  gk_test_abc\n");

    expect(await screen.findByTestId("where")).toHaveTextContent("/app/orders");
    expect(authorization).toBe("Bearer gk_test_abc");
    expect(window.sessionStorage.getItem(KEY)).toBe("gk_test_abc");
  });

  it("anInvalidKeyShowsAFixedMessage", async () => {
    server.use(
      http.get("http://localhost:8080/v1/merchant", () =>
        HttpResponse.json(
          { type: "urn:gateway:UNAUTHENTICATED", status: 401, detail: "secret detail" },
          { status: 401 },
        ),
      ),
    );
    renderWithProviders(routes, { initialEntries: ["/app/login"] });

    await logIn("gk_test_bad");

    expect(await screen.findByText("Chave de API inválida.")).toBeInTheDocument();
    expect(screen.queryByText(/secret detail/)).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("nextIsHonoured", async () => {
    server.use(http.get("http://localhost:8080/v1/merchant", () => HttpResponse.json(merchant)));
    renderWithProviders(routes, { initialEntries: ["/app/login?next=/app/orders/01X"] });

    await logIn("gk_test_abc");

    expect(await screen.findByTestId("where")).toHaveTextContent("/app/orders/01X");
  });
});
