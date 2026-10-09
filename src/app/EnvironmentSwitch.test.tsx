import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { meKeys } from "../auth/authApi";
import { readEnvironment, storeEnvironment } from "../auth/environment";
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
    queryClient.setQueryData(meKeys.me, aMe());
    queryClient.setQueryData(["orders"], []);

    await userEvent.click(screen.getByRole("radio", { name: "LIVE" }));

    const live = screen.getByRole("radio", { name: "LIVE" });
    expect(readEnvironment()).toBe("LIVE");
    expect(queryClient.getQueryData(["orders"])).toBeUndefined();
    expect(queryClient.getQueryData(meKeys.me)).toEqual(aMe());
    expect(live).toHaveAttribute("aria-checked", "true");
    expect(live).toHaveClass("bg-ok-bg", "text-ok-fg");
  });

  it("fallsBackToTestWhenAnUnverifiedUserFindsLiveInStorage", () => {
    storeEnvironment("LIVE");

    renderSwitch(false);

    expect(screen.getByRole("radio", { name: "TEST" })).toHaveAttribute("aria-checked", "true");
    expect(readEnvironment()).toBe("TEST");
  });

  it("theFallbackDropsTheListsCachedUnderLive", async () => {
    storeEnvironment("LIVE");
    const queryClient = new QueryClient();
    queryClient.setQueryData(meKeys.me, aMe({ emailVerified: false }));
    queryClient.setQueryData(["orders"], []);

    render(
      <QueryClientProvider client={queryClient}>
        <EnvironmentSwitch me={aMe({ emailVerified: false })} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(queryClient.getQueryData(["orders"])).toBeUndefined());
    expect(queryClient.getQueryData(meKeys.me)).toBeDefined();
  });
});
