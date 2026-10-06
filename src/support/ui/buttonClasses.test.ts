import { expect, it } from "vitest";
import { buttonClasses } from "./buttonClasses";

// Regression: a colour transition froze the old theme's accent on a hidden tab (see buttonClasses).
it("animates only opacity, so a theme switch repaints the accent at once", () => {
  for (const variant of ["primary", "ghost", "danger", "danger-ghost"] as const) {
    const classes = buttonClasses(variant).split(" ");

    expect(classes).toContain("transition-opacity");
    expect(classes).not.toContain("transition");
    expect(classes).not.toContain("transition-colors");
  }
});
