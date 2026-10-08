import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { AppLayout } from "./AppLayout";

function renderLayout(environment: "TEST" | "LIVE") {
  storeApiKey("gk_test_abc");
  server.use(
    http.get("http://localhost:8080/v1/merchant", () =>
      HttpResponse.json({ merchant_id: "m_1", name: "Loja de Dev", environment }),
    ),
  );
  return renderWithProviders(
    [{ path: "/app", element: <AppLayout />, children: [{ path: "orders", element: <p /> }] }],
    { initialEntries: ["/app/orders"] },
  );
}

// Structure of the approved mockup (panel-two-themes.html); colours are tokens jsdom cannot resolve.
describe("AppLayout header", () => {
  it("is one 56px row: brand, nav with an accent bar on the active item, then env, theme and exit", async () => {
    renderLayout("TEST");

    const header = screen.getByRole("banner");
    const row = header.firstElementChild;
    expect(row).toHaveClass("h-14", "grid-cols-[1fr_auto_1fr]");
    expect(header).toHaveClass("border-b", "border-line", "font-chrome");
    expect(await within(header).findByText("Loja de Dev")).toHaveClass("font-bold");

    const nav = within(header).getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Cobranças" })).toHaveClass("border-accent");
    expect(within(nav).getByRole("link", { name: "Clientes" })).toHaveClass("border-transparent");
    expect(within(nav).getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "href",
      "/app/settings",
    );

    expect(within(header).getByText("TEST")).toHaveClass("bg-warn-bg", "text-warn-fg");
    expect(within(header).getByRole("button", { name: "Alternar tema" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Sair" })).toHaveClass("text-xs");
  });

  it("shows a LIVE merchant in ok tones", async () => {
    renderLayout("LIVE");

    expect(await screen.findByText("LIVE")).toHaveClass("bg-ok-bg", "text-ok-fg");
  });
});
