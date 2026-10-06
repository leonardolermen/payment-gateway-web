import { describe, expect, it } from "vitest";
import { isValidLuhn } from "./luhn";

describe("isValidLuhn", () => {
  it("acceptsAValidNumber", () => {
    expect(isValidLuhn("4024007153763171")).toBe(true);
  });

  it("rejectsAnInvalidNumber", () => {
    expect(isValidLuhn("4024007153763172")).toBe(false);
  });

  it("rejectsEmptyAndNonDigits", () => {
    expect(isValidLuhn("")).toBe(false);
    expect(isValidLuhn("4024 0071 5376 3171")).toBe(false);
  });
});
