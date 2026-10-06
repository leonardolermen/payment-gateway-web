import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { applyTheme } from "../theme";
import { ThemeToggle } from "./ThemeToggle";

beforeEach(() => {
  applyTheme("light");
});

it("flips data-theme on <html> on each click", async () => {
  render(<ThemeToggle />);
  const toggle = screen.getByRole("button", { name: "Alternar tema" });

  await userEvent.click(toggle);
  expect(document.documentElement.dataset.theme).toBe("dark");

  await userEvent.click(toggle);
  expect(document.documentElement.dataset.theme).toBe("light");
});
