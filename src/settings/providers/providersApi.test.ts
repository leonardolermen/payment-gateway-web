import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/msw/server";
import { getProviders, putCredentials, putNotificationKey, testConnection } from "./providersApi";

const API = "http://localhost:8080";

describe("providersApi", () => {
  it("getProvidersReadsTheOverview", async () => {
    const overview = { environment: "TEST", inbound_webhook_url: null, providers: [] };
    server.use(http.get(`${API}/v1/merchant/providers`, () => HttpResponse.json(overview)));

    expect(await getProviders()).toEqual(overview);
  });

  it("putCredentialsSendsExactlyThePayload", async () => {
    let body: unknown = null;
    server.use(
      http.put(`${API}/v1/merchant/providers/ITAU/credentials`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await putCredentials("ITAU", { client_id: "abc" });

    expect(body).toEqual({ payload: { client_id: "abc" } });
  });

  it("testConnectionPostsAndReturnsTheOutcome", async () => {
    const outcome = { ok: true, detail: "ok", checked_at: "2026-10-09T10:00:00Z" };
    server.use(
      http.post(`${API}/v1/merchant/providers/CIELO/test`, () => HttpResponse.json(outcome)),
    );

    expect(await testConnection("CIELO")).toEqual(outcome);
  });

  it("putNotificationKeySendsTheKey", async () => {
    let body: unknown = null;
    server.use(
      http.put(`${API}/v1/merchant/providers/CIELO/notification-key`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await putNotificationKey("k-1");

    expect(body).toEqual({ key: "k-1" });
  });
});
