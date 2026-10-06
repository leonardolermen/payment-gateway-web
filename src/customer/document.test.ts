import { describe, expect, it } from "vitest";
import { isCpfOrCnpjShape, maskDocument, onlyDigits } from "./document";

describe("document", () => {
  it("masksACpf", () => {
    expect(maskDocument("123.456.789-09")).toBe("***.456.789-**");
    expect(maskDocument("12345678909")).toBe("***.456.789-**");
  });

  it("masksACnpj", () => {
    expect(maskDocument("12345678000195")).toBe("**.345.678/0001-**");
  });

  it("leavesAlreadyMaskedAndUnknownShapesAlone", () => {
    expect(maskDocument("***.456.789-**")).toBe("***.456.789-**");
    expect(maskDocument("123")).toBe("123");
  });

  it("recognisesTheShapeByDigitCount", () => {
    expect(onlyDigits("123.456.789-09")).toBe("12345678909");
    expect(isCpfOrCnpjShape("123.456.789-09")).toBe(true);
    expect(isCpfOrCnpjShape("12345678000195")).toBe(true);
    expect(isCpfOrCnpjShape("1234567890")).toBe(false);
  });
});
