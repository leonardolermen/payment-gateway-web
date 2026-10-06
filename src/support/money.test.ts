import { describe, expect, it } from "vitest";
import { formatBrl, parseBrl } from "./money";

describe("formatBrl", () => {
  it("formats cents as pt-BR currency", () => {
    expect(formatBrl(123456)).toBe("R$ 1.234,56");
    expect(formatBrl(5)).toBe("R$ 0,05");
  });
});

describe("parseBrl", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["R$ 12", 1200],
    ["12", 1200],
    ["0,10", 10],
  ])("parses %s to %i cents", (input, cents) => {
    expect(parseBrl(input)).toBe(cents);
  });

  it.each(["", "   ", "0", "0,00", "-5", "abc", "1,2,3"])("refuses %s", (input) => {
    expect(parseBrl(input)).toBeNull();
  });

  it("never goes through floating point", () => {
    expect(parseBrl("0,29")).toBe(29); // 0.29 * 100 === 28.999999999999996 in JS
  });
});
