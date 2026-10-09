import { describe, expect, it } from "vitest";
import { clearSession, readAccessToken, setAccessToken } from "./session";

describe("session", () => {
  it("theAccessTokenNeverTouchesStorage", () => {
    setAccessToken("gs_abc");

    expect(readAccessToken()).toBe("gs_abc");
    expect(JSON.stringify(window.localStorage)).not.toContain("gs_abc");
    expect(JSON.stringify(window.sessionStorage)).not.toContain("gs_abc");

    clearSession();

    expect(readAccessToken()).toBeNull();
  });
});
