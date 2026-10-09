import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";
import { useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { merchantRequest } from "../support/merchantRequest";
import { renderWithProviders } from "../test/render";
import { server } from "../test/msw/server";
import { storeApiKey } from "./apiKey";
import { readAccessToken, setAccessToken } from "./session";
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

  it("clears the session and redirects when a request gets a 401 and the refresh fails", async () => {
    storeApiKey("gk_test_abc");
    setAccessToken("gs_test");
    server.use(
      http.post("http://localhost:8080/v1/auth/refresh", () =>
        HttpResponse.json(
          { type: "urn:gateway:SESSION_EXPIRED", status: 401, detail: "x" },
          { status: 401 },
        ),
      ),
      http.get("http://localhost:8080/v1/orders", () =>
        HttpResponse.json(
          { type: "urn:gateway:UNAUTHENTICATED", status: 401, detail: "x" },
          { status: 401 },
        ),
      ),
    );
    renderWithProviders(routesFor(<Caller />), { initialEntries: ["/app/orders"] });

    expect(await screen.findByTestId("login")).toHaveTextContent("/app/login?next=%2Fapp%2Forders");
    expect(readAccessToken()).toBeNull();
  });

  it("drops the cached data of the previous key on a 401", async () => {
    storeApiKey("gk_test_abc");
    server.use(
      http.get("http://localhost:8080/v1/orders", () =>
        HttpResponse.json(
          { type: "urn:gateway:UNAUTHENTICATED", status: 401, detail: "x" },
          { status: 401 },
        ),
      ),
    );
    const { queryClient } = renderWithProviders(routesFor(<Caller />), {
      initialEntries: ["/app/orders"],
    });
    queryClient.setQueryData(["merchant"], { name: "A" });

    await screen.findByTestId("login");

    expect(queryClient.getQueryData(["merchant"])).toBeUndefined();
  });
});
