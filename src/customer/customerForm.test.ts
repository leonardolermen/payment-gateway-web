import { describe, expect, it } from "vitest";
import { GatewayRequestError } from "../support/gatewayError";
import { invalidFieldOf } from "./customerForm";

function invalid(detail: string, code = "CUSTOMER_INVALID") {
  return new GatewayRequestError({ status: 422, code, detail, extras: {} });
}

describe("invalidFieldOf", () => {
  // The gateway sends no `field`: CUSTOMER_INVALID starts its detail with the name as sent.
  it.each([
    ["customer.name is required", "name"],
    ["customer.document is not a valid CPF or CNPJ", "document"],
    ["customer.email must be an e-mail", "email"],
    ["customer.address.zip must have 8 digits", "zip"],
    ["customer.address.state is required", "state"],
  ] as const)("reads %s as %s", (detail, field) => {
    expect(invalidFieldOf(invalid(detail))).toBe(field);
  });

  it("namesNoFieldForAnUnknownLeadOrAnotherCode", () => {
    expect(invalidFieldOf(invalid("customer is incomplete"))).toBeUndefined();
    expect(invalidFieldOf(invalid("customer.name x", "INVALID_REQUEST"))).toBeUndefined();
    expect(invalidFieldOf(new Error("customer.name"))).toBeUndefined();
  });
});
