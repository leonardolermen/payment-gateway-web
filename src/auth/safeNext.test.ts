import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("keepsASameOriginPath", () => {
    expect(safeNext("/app/plans?page=2")).toBe("/app/plans?page=2");
  });

  it("fallsBackWhenMissingOrNotAPath", () => {
    expect(safeNext(null)).toBe("/app/orders");
    expect(safeNext("https://evil.com")).toBe("/app/orders");
  });

  it("refusesAProtocolRelativeUrl", () => {
    expect(safeNext("//evil.com", "/app/settings")).toBe("/app/settings");
  });
});
