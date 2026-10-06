import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, onSystemThemeChange, resolveTheme, toggleTheme } from "./theme";

type Listener = (event: { matches: boolean }) => void;

function mockSystem(prefersDark: boolean) {
  const listeners: Listener[] = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: prefersDark,
      addEventListener: (_: string, listener: Listener) => listeners.push(listener),
      removeEventListener: (_: string, listener: Listener) =>
        listeners.splice(listeners.indexOf(listener), 1),
    })),
  );
  return listeners;
}

describe("theme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("follows the system when nothing is saved", () => {
    mockSystem(true);
    expect(resolveTheme()).toBe("dark");

    mockSystem(false);
    expect(resolveTheme()).toBe("light");
  });

  it("lets the saved choice win over the system", () => {
    mockSystem(true);
    window.localStorage.setItem("gateway.theme", "light");

    expect(resolveTheme()).toBe("light");
  });

  it("falls back to light when storage and matchMedia both throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.stubGlobal("matchMedia", () => {
      throw new Error("missing");
    });

    expect(resolveTheme()).toBe("light");
  });

  it("does not break when storage refuses to write", () => {
    mockSystem(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(toggleTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggles, applies and persists", () => {
    mockSystem(false);
    applyTheme("light");

    expect(toggleTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("gateway.theme")).toBe("dark");

    expect(toggleTheme()).toBe("light");
    expect(window.localStorage.getItem("gateway.theme")).toBe("light");
  });

  it("reports system changes and can be unsubscribed", () => {
    const listeners = mockSystem(false);
    const callback = vi.fn();

    const unsubscribe = onSystemThemeChange(callback);
    listeners[0]?.({ matches: true });
    expect(callback).toHaveBeenCalledWith("dark");

    unsubscribe();
    expect(listeners).toHaveLength(0);
  });

  // The accent must come from the stylesheet's [data-theme] block only: an inline --accent on
  // <html> would outrank it and pin one theme's colour under the other.
  it("switches themes through data-theme alone, never an inline style", () => {
    mockSystem(false);
    applyTheme("dark");
    expect(document.documentElement.getAttribute("style")).toBeNull();

    toggleTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.getAttribute("style")).toBeNull();
    expect(document.documentElement.getAttributeNames().sort()).toEqual(["data-theme"]);
  });
});
