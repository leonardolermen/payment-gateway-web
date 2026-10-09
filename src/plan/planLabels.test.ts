import { describe, expect, it } from "vitest";
import { priceLabel, trialLabel } from "./planLabels";

describe("plan labels", () => {
  it("singleIntervalsReadAsPer", () => {
    expect(priceLabel({ amount: 4990, interval: "MONTH", interval_count: 1 })).toBe(
      "R$ 49,90 / mês",
    );
    expect(priceLabel({ amount: 1000, interval: "WEEK", interval_count: 1 })).toBe(
      "R$ 10,00 / semana",
    );
    expect(priceLabel({ amount: 50000, interval: "YEAR", interval_count: 1 })).toBe(
      "R$ 500,00 / ano",
    );
    expect(priceLabel({ amount: 100, interval: "DAY", interval_count: 1 })).toBe("R$ 1,00 / dia");
  });

  it("multipleIntervalsReadAsEvery", () => {
    expect(priceLabel({ amount: 12000, interval: "MONTH", interval_count: 3 })).toBe(
      "R$ 120,00 a cada 3 meses",
    );
    expect(priceLabel({ amount: 100, interval: "DAY", interval_count: 2 })).toBe(
      "R$ 1,00 a cada 2 dias",
    );
    expect(priceLabel({ amount: 100, interval: "WEEK", interval_count: 2 })).toBe(
      "R$ 1,00 a cada 2 semanas",
    );
    expect(priceLabel({ amount: 100, interval: "YEAR", interval_count: 2 })).toBe(
      "R$ 1,00 a cada 2 anos",
    );
  });

  it("trialReadsInDays", () => {
    expect(trialLabel(0)).toBe("sem trial");
    expect(trialLabel(1)).toBe("1 dia");
    expect(trialLabel(7)).toBe("7 dias");
  });
});
