import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { clearSession, readAccessToken, setAccessToken } from "./session";
import { login, logout } from "./authApi";

const API = "http://localhost:8080";

afterEach(() => clearSession());

describe("authApi", () => {
  it("loginStoresTheAccessTokenAndSendsTheCookieJar", async () => {
    let credentials: RequestCredentials | null = null;
    server.use(
      http.post(`${API}/v1/auth/login`, ({ request }) => {
        credentials = request.credentials;
        return HttpResponse.json({ access_token: "gs_new", expires_in: 900 });
      }),
    );

    await login({ email: "ana@loja.com", password: "senha-forte-1" });

    expect(readAccessToken()).toBe("gs_new");
    expect(credentials).toBe("include");
  });

  it("logoutClearsTheSessionEvenIfTheCallFails", async () => {
    server.use(http.post(`${API}/v1/auth/logout`, () => HttpResponse.error()));
    setAccessToken("gs_x");

    await expect(logout()).rejects.toThrow();

    expect(readAccessToken()).toBeNull();
  });
});
