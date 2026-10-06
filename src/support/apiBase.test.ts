import { afterEach, describe, expect, it, vi } from "vitest";

async function load() {
  vi.resetModules();
  return import("./apiBase");
}

describe("apiBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stripsTheTrailingSlash", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/");

    expect((await load()).API_BASE).toBe("https://api.example.com");
  });

  it("throwsWhenUnset", async () => {
    vi.stubEnv("VITE_API_URL", "");

    await expect(load()).rejects.toThrow("VITE_API_URL is not set");
  });

  it("throwsWhenNotAnHttpUrl", async () => {
    vi.stubEnv("VITE_API_URL", "api.example.com");

    await expect(load()).rejects.toThrow("VITE_API_URL is not set");
  });
});
