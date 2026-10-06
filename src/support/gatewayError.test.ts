import { describe, expect, it } from "vitest";
import { GatewayRequestError, NetworkError, messageFor, problemToError } from "./gatewayError";

describe("problemToError", () => {
  it("reads the code from the urn and keeps extras", () => {
    const error = problemToError(
      409,
      {
        type: "urn:gateway:ORDER_HAS_ACTIVE_PAYMENT",
        title: "Conflict",
        status: 409,
        detail: "order x has an active payment",
        payment_id: "01ABC",
      },
      new Headers(),
    );
    expect(error.code).toBe("ORDER_HAS_ACTIVE_PAYMENT");
    expect(error.extras.payment_id).toBe("01ABC");
  });

  it("reads Retry-After on a 429", () => {
    const error = problemToError(
      429,
      { type: "urn:gateway:RATE_LIMITED", status: 429, detail: "x" },
      new Headers({ "Retry-After": "7" }),
    );
    expect(error.retryAfterSeconds).toBe(7);
  });

  it("falls back to UNKNOWN when the body is not a problem", () => {
    expect(problemToError(502, "<html>", new Headers()).code).toBe("UNKNOWN");
  });
});

describe("messageFor", () => {
  it("translates known codes to Portuguese", () => {
    const error = new GatewayRequestError({
      status: 410,
      code: "CHECKOUT_ORDER_CLOSED",
      detail: "x",
      extras: {},
    });
    expect(messageFor(error)).toBe("Este link de pagamento não está mais disponível.");
  });

  it("uses the detail for unknown codes", () => {
    const error = new GatewayRequestError({
      status: 422,
      code: "SOMETHING_NEW",
      detail: "the thing is wrong",
      extras: {},
    });
    expect(messageFor(error)).toBe("the thing is wrong");
  });

  it("names the network for a NetworkError", () => {
    expect(messageFor(new NetworkError())).toBe(
      "Não foi possível falar com o servidor. Tente de novo.",
    );
  });
});
