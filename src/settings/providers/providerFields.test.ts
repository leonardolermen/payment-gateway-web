import { describe, expect, it } from "vitest";
import { PROVIDER_FIELDS, fieldsFor, isSecret, providerTitle, secretNames } from "./providerFields";

describe("providerFields", () => {
  it("testHidesTheLiveOnlyItauFields", () => {
    const test = fieldsFor("ITAU", "TEST").map((spec) => spec.name);
    const live = fieldsFor("ITAU", "LIVE").map((spec) => spec.name);

    expect(test).not.toContain("certificate_pem");
    expect(test).not.toContain("x_itau_apikey");
    expect(live).toContain("certificate_pem");
    expect(live).toContain("private_key_pem");
  });

  it("cieloHasTwoFields", () => {
    expect(fieldsFor("CIELO", "TEST").map((spec) => spec.name)).toEqual([
      "merchant_id",
      "merchant_key",
    ]);
  });

  it("secretNamesMatchTheGatewayList", () => {
    expect(secretNames("ITAU")).toEqual(["client_secret", "x_itau_apikey", "private_key_pem"]);
    expect(secretNames("CIELO")).toEqual(["merchant_key"]);
  });

  it("privateKeyIsAPemAndASecret", () => {
    const spec = PROVIDER_FIELDS.ITAU.find((field) => field.name === "private_key_pem")!;

    expect(spec.kind).toBe("pem");
    expect(isSecret(spec)).toBe(true);
  });

  it("titlesAreHumanReadable", () => {
    expect(providerTitle("ITAU")).toBe("Pix e boleto · Itaú");
    expect(providerTitle("CIELO")).toBe("Cartão · Cielo");
  });
});
