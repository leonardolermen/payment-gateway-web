import { describe, expect, it } from "vitest";
import { previewInstallments } from "./installmentPreview";

function settings(max: number, freeUpTo: number, bps: number) {
  return { max_installments: max, interest_free_up_to: freeUpTo, monthly_rate_bps: bps };
}

// Every number here comes from the gateway's InstallmentPricingTest. A divergence is a bug here.
describe("previewInstallments", () => {
  it("matchesTheGatewayVectors", () => {
    const options = previewInstallments(10000, settings(12, 1, 299));

    expect(options[2]).toEqual({ count: 3, installment: 3535, total: 10605, interestFree: false });
    expect(options[5]).toEqual({ count: 6, installment: 1846, total: 11076, interestFree: false });
  });

  it("interestFreeOnesAreTruncatedAndTotalTheAmount", () => {
    const options = previewInstallments(10000, settings(10, 3, 299));

    expect(options).toHaveLength(10);
    expect(
      options.slice(0, 3).every((option) => option.interestFree && option.total === 10000),
    ).toBe(true);
    expect(options[3]).toEqual({ count: 4, installment: 2690, total: 10760, interestFree: false });
    expect(options[9]).toEqual({ count: 10, installment: 1172, total: 11720, interestFree: false });
  });

  it("aZeroRateIsAllInterestFree", () => {
    const options = previewInstallments(10000, settings(12, 1, 0));

    expect(options).toHaveLength(12);
    expect(options.every((option) => option.interestFree && option.total === 10000)).toBe(true);
    expect(options[11]).toEqual({ count: 12, installment: 833, total: 10000, interestFree: true });
  });

  it("anInstallmentUnderFiveReaisIsNotOffered", () => {
    const counts = previewInstallments(2000, settings(12, 1, 299)).map((option) => option.count);

    expect(counts).toEqual([1, 2, 3, 4]);
    expect(previewInstallments(300, settings(12, 12, 0)).map((option) => option.count)).toEqual([
      1,
    ]);
  });
});
