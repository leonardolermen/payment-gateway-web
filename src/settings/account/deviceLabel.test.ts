import { describe, expect, it } from "vitest";
import { deviceLabel } from "./deviceLabel";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";

describe("deviceLabel", () => {
  it("namesTheBrowserAndTheSystem", () => {
    expect(deviceLabel(CHROME_WINDOWS)).toBe("Chrome · Windows");
    expect(deviceLabel(SAFARI_IPHONE)).toBe("Safari · iPhone");
    expect(deviceLabel(FIREFOX_LINUX)).toBe("Firefox · Linux");
    expect(deviceLabel(EDGE_WINDOWS)).toBe("Edge · Windows");
  });

  it("cutsAnUnknownAgentShort", () => {
    expect(deviceLabel("curl/8.9.1 something-long-enough-to-be-cut-off-here")).toBe(
      "curl/8.9.1 something-long-enough-to-be-c…",
    );
    expect(deviceLabel("curl/8.9.1")).toBe("curl/8.9.1");
  });

  it("showsADashWithoutAnAgent", () => {
    expect(deviceLabel(null)).toBe("—");
  });
});
