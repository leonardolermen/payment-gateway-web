import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { readEnvironment } from "../auth/environment";
import { aMe } from "../test/me";
import { renderWithProviders } from "../test/render";
import { EnvironmentSwitch } from "./EnvironmentSwitch";

function renderSwitch(emailVerified: boolean) {
  return renderWithProviders([
    { path: "/", element: <EnvironmentSwitch me={aMe({ emailVerified })} /> },
  ]);
}

describe("EnvironmentSwitch", () => {
  it("keepsLiveOffUntilTheEmailIsConfirmed", () => {
    renderSwitch(false);

    const live = screen.getByRole("radio", { name: "LIVE" });
    expect(live).toBeDisabled();
    expect(live).toHaveAttribute("title", "Confirme seu e-mail para usar produção");
    expect(screen.getByRole("radio", { name: "TEST" })).toHaveAttribute("aria-checked", "true");
  });

  it("switchesToLiveAndDropsTheCachedTestData", async () => {
    const { queryClient } = renderSwitch(true);
    const clear = vi.spyOn(queryClient, "clear");

    await userEvent.click(screen.getByRole("radio", { name: "LIVE" }));

    const live = screen.getByRole("radio", { name: "LIVE" });
    expect(readEnvironment()).toBe("LIVE");
    expect(clear).toHaveBeenCalled();
    expect(live).toHaveAttribute("aria-checked", "true");
    expect(live).toHaveClass("bg-ok-bg", "text-ok-fg");
  });
});
