import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { request } from "./http";

describe("request", () => {
  it("sends the bearer key and the idempotency key and parses json", async () => {
    let seen: Headers | undefined;
    server.use(
      http.post("http://localhost:8080/v1/orders", async ({ request: req }) => {
        seen = req.headers;
        return HttpResponse.json({ id: "01X" }, { status: 201 });
      }),
    );

    const { data } = await request<{ id: string }>("/v1/orders", {
      method: "POST",
      body: { amount: 1 },
      apiKey: "gk_test_x",
      idempotencyKey: "k1",
    });

    expect(data.id).toBe("01X");
    expect(seen?.get("authorization")).toBe("Bearer gk_test_x");
    expect(seen?.get("idempotency-key")).toBe("k1");
  });

  it("throws a GatewayRequestError with the parsed problem on 4xx", async () => {
    server.use(
      http.get("http://localhost:8080/v1/orders/nope", () =>
        HttpResponse.json(
          { type: "urn:gateway:NOT_FOUND", status: 404, detail: "order not found: nope" },
          { status: 404 },
        ),
      ),
    );

    await expect(request("/v1/orders/nope", { apiKey: "k" })).rejects.toMatchObject({
      error: { code: "NOT_FOUND", status: 404 },
    });
  });

  it("never sends the key when none is given", async () => {
    let seen: Headers | undefined;
    server.use(
      http.get("http://localhost:8080/v1/checkout/chk_x", ({ request: req }) => {
        seen = req.headers;
        return HttpResponse.json({});
      }),
    );

    await request("/v1/checkout/chk_x");

    expect(seen?.has("authorization")).toBe(false);
  });
});
