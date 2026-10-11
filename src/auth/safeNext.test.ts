import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("keepsASameOriginPath", () => {
    expect(safeNext("/app/orders/01X?x=1")).toBe("/app/orders/01X?x=1");
  });

  it("normalisesALegitimatePath", () => {
    expect(safeNext("/a/../app/orders")).toBe("/app/orders");
  });

  it("fallsBackWhenMissing", () => {
    expect(safeNext(null, "/app/settings")).toBe("/app/settings");
  });

  it.each([
    "/\\evil.com",
    "/\t/evil.com",
    "//evil.com",
    "javascript:alert(1)",
    "https://evil.com/x",
    "/..//evil.com",
    "/.//evil.com",
    "/a/..//evil.com",
  ])("refusesAnythingThatLeavesTheOrigin %j", (next) => {
    expect(safeNext(next)).toBe("/app/orders");
  });
});
