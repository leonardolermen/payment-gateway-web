export type Theme = "light" | "dark";

// Same key and fallback order as public/theme-init.js, which paints before React loads; a
// mismatch would make the page flip theme a moment after the first paint.
const STORAGE_KEY = "gateway.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function savedTheme(): Theme | null {
  // Storage throws in some private modes and when site data is blocked; a missing choice is fine.
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function savedThemeExists(): boolean {
  return savedTheme() !== null;
}

export function resolveTheme(): Theme {
  return savedTheme() ?? systemTheme();
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);

  // The toggle still works for this visit when storage refuses the write.
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not remembered; nothing else to do.
  }

  return next;
}

export function onSystemThemeChange(callback: (theme: Theme) => void): () => void {
  try {
    const media = window.matchMedia(DARK_QUERY);
    const listener = (event: { matches: boolean }) => callback(event.matches ? "dark" : "light");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  } catch {
    return () => {};
  }
}
