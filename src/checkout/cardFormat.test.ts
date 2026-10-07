import { describe, expect, it } from "vitest";
import { cvvLength, expiryError, groupDigits, maxDigits, toApiExpiry } from "./cardFormat";

const OCT_2026 = new Date(2026, 9, 7);

describe("card format", () => {
  it("groupsAmexAs4_6_5AndTheOthersInFours", () => {
    expect(groupDigits("378282246310005", "amex")).toBe("3782 822463 10005");
    expect(groupDigits("4024007153763171", "visa")).toBe("4024 0071 5376 3171");
    expect(groupDigits("37828", "amex")).toBe("3782 8");
  });

  it("knowsTheAmexLengths", () => {
    expect(maxDigits("amex")).toBe(15);
    expect(cvvLength("amex")).toBe(4);
    expect(maxDigits("visa")).toBe(19);
    expect(cvvLength(null)).toBe(3);
  });

  it("acceptsTheCurrentMonthAndRefusesAPastOrImpossibleOne", () => {
    expect(expiryError("10/26", OCT_2026)).toBeNull();
    expect(expiryError("01/30", OCT_2026)).toBeNull();
    expect(expiryError("09/26", OCT_2026)).toBe("Cartão vencido.");
    expect(expiryError("13/30", OCT_2026)).toBe("Mês de validade inválido.");
    expect(expiryError("00/30", OCT_2026)).toBe("Mês de validade inválido.");
    expect(expiryError("1/3", OCT_2026)).toBe("Informe a validade como MM/AA.");
  });

  it("sendsTheYearWithFourDigits", () => {
    expect(toApiExpiry("12/30")).toBe("12/2030");
  });
});
