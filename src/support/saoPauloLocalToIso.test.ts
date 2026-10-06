import { describe, expect, it } from "vitest";
import { saoPauloLocalToIso } from "./dates";

describe("saoPauloLocalToIso", () => {
  it("appliesTheSaoPauloOffset", () => {
    expect(saoPauloLocalToIso("2026-10-10T12:00")).toBe("2026-10-10T15:00:00.000Z");
  });

  it("usesTheOffsetOfThatDateNotOfToday", () => {
    // Brazil observed DST until 2019: -02:00 in January 2018.
    expect(saoPauloLocalToIso("2018-01-10T12:00")).toBe("2018-01-10T14:00:00.000Z");
  });

  it("returnsNullForEmptyOrGarbage", () => {
    expect(saoPauloLocalToIso("")).toBeNull();
    expect(saoPauloLocalToIso("nope")).toBeNull();
  });
});
