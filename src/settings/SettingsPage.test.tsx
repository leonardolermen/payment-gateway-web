import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../auth/session";
import type { Role } from "../auth/types";
import { aMe, mockMe } from "../test/me";
import { renderWithProviders } from "../test/render";
import { SettingsPage } from "./SettingsPage";

function renderAs(role: Role, url = "/app/settings") {
  setAccessToken("gs_test");
  mockMe(aMe({ role }));
  return renderWithProviders([{ path: "/app/settings", element: <SettingsPage /> }], {
    initialEntries: [url],
  });
}

async function tabNames() {
  await screen.findByRole("tab", { name: "Conta" });
  return screen.getAllByRole("tab").map((tab) => tab.textContent);
}

describe("SettingsPage", () => {
  it("anOwnerSeesEveryTab", async () => {
    renderAs("OWNER");

    expect(await tabNames()).toEqual(["Conta", "Minha conta", "Parcelamento", "Equipe"]);
  });

  it.each<Role>(["FINANCE", "READONLY"])("%sSeesOnlyTheAccountTabs", async (role) => {
    renderAs(role);

    expect(await tabNames()).toEqual(["Conta", "Minha conta"]);
  });

  it("aDisallowedTabInTheUrlFallsBackToConta", async () => {
    renderAs("FINANCE", "/app/settings?tab=team");

    expect(await screen.findByRole("tab", { name: "Conta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("Loja de Dev")).toBeInTheDocument();
  });

  it("deepLinksToConta", async () => {
    renderAs("OWNER", "/app/settings?tab=account");

    expect(await screen.findByRole("tab", { name: "Conta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("deepLinksToMinhaConta", async () => {
    renderAs("READONLY", "/app/settings?tab=profile");

    expect(await screen.findByRole("tab", { name: "Minha conta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
