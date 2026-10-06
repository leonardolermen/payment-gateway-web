import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { merchantRequest } from "../support/merchantRequest";
import { renderWithProviders } from "../test/render";
import { server } from "../test/msw/server";
import { readApiKey, storeApiKey } from "./apiKey";
import { RequireApiKey } from "./RequireApiKey";

function Login() {
  const location = useLocation();
  return <div data-testid="login">{location.pathname + location.search}</div>;
}

function Child() {
  return <div>conteudo</div>;
}

function Caller() {
  useEffect(() => {
    merchantRequest("/v1/orders").catch(() => undefined);
  }, []);
  return <div>conteudo</div>;
}

function routesFor(child: React.ReactNode) {
  return [
    { path: "/app/login", element: <Login /> },
    { element: <RequireApiKey />, children: [{ path: "/app/orders", element: child }] },
  ];
}

describe("RequireApiKey", () => {
  it("redirects to login with next when there is no key", async () => {
    renderWithProviders(routesFor(<Child />), { initialEntries: ["/app/orders"] });

    expect(await screen.findByTestId("login")).toHaveTextContent("/app/login?next=%2Fapp%2Forders");
  });

  it("renders the child when a key exists", () => {
    storeApiKey("gk_test_abc");
    renderWithProviders(routesFor(<Child />), { initialEntries: ["/app/orders"] });

    expect(screen.getByText("conteudo")).toBeInTheDocument();
  });

  it("clears the key and redirects when a request gets a 401", async () => {
    storeApiKey("gk_test_abc");
    server.use(
      http.get("http://localhost:8080/v1/orders", () =>
        HttpResponse.json(
          { type: "urn:gateway:UNAUTHENTICATED", status: 401, detail: "x" },
          { status: 401 },
        ),
      ),
    );
    renderWithProviders(routesFor(<Caller />), { initialEntries: ["/app/orders"] });

    expect(await screen.findByTestId("login")).toHaveTextContent("/app/login?next=%2Fapp%2Forders");
    expect(readApiKey()).toBeNull();
  });
});
