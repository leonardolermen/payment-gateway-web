import { describe, expect, it } from "vitest";
import { bpsToPercent, percentToBps } from "./installmentApi";

describe("percent and bps", () => {
  it("percentTextAndBpsRoundTrip", () => {
    expect(percentToBps("2,99")).toBe(299);
    expect(percentToBps("2.99")).toBe(299);
    expect(percentToBps("2,9")).toBe(290);
    expect(percentToBps("10")).toBe(1000);
    expect(percentToBps("0")).toBe(0);
    expect(bpsToPercent(299)).toBe("2,99");
    expect(bpsToPercent(290)).toBe("2,90");
    expect(bpsToPercent(0)).toBe("0,00");
    expect(bpsToPercent(percentToBps("1,5")!)).toBe("1,50");
  });

  it("refusesWhatIsNotAWholeBps", () => {
    expect(percentToBps("")).toBeNull();
    expect(percentToBps("abc")).toBeNull();
    expect(percentToBps("2,999")).toBeNull();
    expect(percentToBps("-1")).toBeNull();
  });
});
