import { describe, expect, it } from "vitest";
import { ENVIRONMENT_KEY, readEnvironment, storeEnvironment } from "./environment";

describe("environment", () => {
  it("defaultsToTestAndRemembersLive", () => {
    expect(readEnvironment()).toBe("TEST");

    storeEnvironment("LIVE");

    expect(window.localStorage.getItem(ENVIRONMENT_KEY)).toBe("LIVE");
    expect(readEnvironment()).toBe("LIVE");
  });

  it("anythingElseInStorageReadsAsTest", () => {
    window.localStorage.setItem(ENVIRONMENT_KEY, "live");

    expect(readEnvironment()).toBe("TEST");
  });
});
