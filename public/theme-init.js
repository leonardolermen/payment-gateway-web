// Runs before the bundle so the first paint already has the right theme (no light flash for a
// dark user). Mirrors src/support/theme.ts: saved choice wins, else the system preference.
(function () {
  var theme = "light";
  try {
    var saved = window.localStorage.getItem("gateway.theme");
    if (saved === "light" || saved === "dark") {
      theme = saved;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    }
  } catch (e) {
    // Storage or matchMedia unavailable: light is the readable default.
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
