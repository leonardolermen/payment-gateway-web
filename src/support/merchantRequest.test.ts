import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storeEnvironment } from "../auth/environment";
import { clearSession, readAccessToken, setAccessToken } from "../auth/session";
import { server } from "../test/msw/server";
import { merchantRequest, onUnauthenticated, Unauthenticated } from "./merchantRequest";

const API = "http://localhost:8080";

const expired = () =>
  HttpResponse.json(
    { type: "urn:gateway:SESSION_EXPIRED", status: 401, detail: "x" },
    { status: 401 },
  );

const freshOnly = (request: Request) =>
  request.headers.get("authorization") === "Bearer gs_fresh" ? HttpResponse.json([]) : expired();

afterEach(() => clearSession());

describe("merchantRequest", () => {
  it("sendsTheBearerAndTheEnvironment", async () => {
    setAccessToken("gs_one");
    storeEnvironment("LIVE");
    let seen: Headers | null = null;
    server.use(
      http.get(`${API}/v1/orders`, ({ request }) => {
        seen = request.headers;
        return HttpResponse.json([]);
      }),
    );

    await merchantRequest("/v1/orders");

    expect(seen!.get("authorization")).toBe("Bearer gs_one");
    expect(seen!.get("x-environment")).toBe("LIVE");
  });

  it("aStaleAccessTokenRefreshesOnceAndRetries", async () => {
    setAccessToken("gs_stale");
    const bearers: (string | null)[] = [];
    let refreshCalls = 0;
    server.use(
      http.get(`${API}/v1/orders`, ({ request }) => {
        bearers.push(request.headers.get("authorization"));
        return request.headers.get("authorization") === "Bearer gs_fresh"
          ? HttpResponse.json([{ id: "o1" }])
          : expired();
      }),
      http.post(`${API}/v1/auth/refresh`, ({ request }) => {
        refreshCalls += 1;
        expect(request.credentials).toBe("include");
        return HttpResponse.json({ access_token: "gs_fresh", expires_in: 900 });
      }),
    );

    const { data } = await merchantRequest<{ id: string }[]>("/v1/orders");

    expect(data).toEqual([{ id: "o1" }]);
    expect(bearers).toEqual(["Bearer gs_stale", "Bearer gs_fresh"]);
    expect(refreshCalls).toBe(1);
    expect(readAccessToken()).toBe("gs_fresh");
  });

  it("aDeadRefreshGoesToLoginWithoutLooping", async () => {
    setAccessToken("gs_stale");
    let orderCalls = 0;
    const listener = vi.fn();
    const off = onUnauthenticated(listener);
    server.use(
      http.get(`${API}/v1/orders`, () => {
        orderCalls += 1;
        return expired();
      }),
      http.post(`${API}/v1/auth/refresh`, () => expired()),
    );

    await expect(merchantRequest("/v1/orders")).rejects.toBeInstanceOf(Unauthenticated);

    expect(orderCalls).toBe(1);
    expect(readAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("concurrent401sShareOneRefresh", async () => {
    setAccessToken("gs_stale");
    let refreshCalls = 0;
    server.use(
      http.get(`${API}/v1/orders`, ({ request }) => freshOnly(request)),
      http.get(`${API}/v1/customers`, ({ request }) => freshOnly(request)),
      http.post(`${API}/v1/auth/refresh`, async () => {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return HttpResponse.json({ access_token: "gs_fresh", expires_in: 900 });
      }),
    );

    await Promise.all([merchantRequest("/v1/orders"), merchantRequest("/v1/customers")]);

    expect(refreshCalls).toBe(1);
  });
});
