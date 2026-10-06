import { afterEach, describe, expect, it, vi } from "vitest";
import { clearApiKey, KEY, readApiKey, storeApiKey } from "./apiKey";

describe("apiKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores the trimmed key, reads it back and clears it", () => {
    storeApiKey("  gk_test_abc\n");

    expect(readApiKey()).toBe("gk_test_abc");
    expect(window.sessionStorage.getItem(KEY)).toBe("gk_test_abc");

    clearApiKey();

    expect(readApiKey()).toBeNull();
  });

  it("survives a throwing sessionStorage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(() => storeApiKey("gk_test_abc")).not.toThrow();
    expect(readApiKey()).toBeNull();
  });
});
