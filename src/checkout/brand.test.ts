import { describe, expect, it } from "vitest";
import { brandOf } from "./brand";

describe("brandOf", () => {
  it.each([
    ["4024007153763171", "visa"],
    ["5555555555554444", "mastercard"],
    ["2221000000000009", "mastercard"],
    ["378282246310005", "amex"],
    ["6362970000457013", "elo"],
    ["6062825624254001", "hipercard"],
  ])("detects %s as %s", (digits, brand) => {
    expect(brandOf(digits)).toBe(brand);
  });

  it("returnsNullForUnknownOrEmpty", () => {
    expect(brandOf("")).toBeNull();
    expect(brandOf("9999999999999999")).toBeNull();
  });
});
