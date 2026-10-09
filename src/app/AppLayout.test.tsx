import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { storeEnvironment, type Environment } from "../auth/environment";
import { clearSession, setAccessToken } from "../auth/session";
import { aMe, mockMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { AppLayout } from "./AppLayout";

type Setup = { emailVerified?: boolean; environment?: Environment };

function renderLayout({ emailVerified = true, environment = "TEST" }: Setup = {}) {
  setAccessToken("gs_test");
  storeEnvironment(environment);
  mockMe(aMe({ emailVerified }));

  return renderWithProviders(
    [
      { path: "/app", element: <AppLayout />, children: [{ path: "orders", element: <p /> }] },
      { path: "/login", element: <p>Tela de login</p> },
    ],
    { initialEntries: ["/app/orders"] },
  );
}

afterEach(() => clearSession());

// Structure of the approved mockup (panel-two-themes.html); colours are tokens jsdom cannot resolve.
describe("AppLayout header", () => {
  it("showsTheStoreTheNavTheSwitchTheThemeAndWhoIsIn", async () => {
    renderLayout();

    const header = screen.getByRole("banner");
    expect(header.firstElementChild).toHaveClass("h-14", "grid-cols-[1fr_auto_1fr]");
    expect(await within(header).findByText("Loja de Dev")).toHaveClass("font-bold");

    const nav = within(header).getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Cobranças" })).toHaveClass("border-accent");
    expect(within(nav).getByRole("link", { name: "Clientes" })).toHaveAttribute(
      "href",
      "/app/customers",
    );
    expect(within(nav).getByRole("link", { name: "Planos" })).toHaveAttribute("href", "/app/plans");
    expect(within(nav).getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "href",
      "/app/settings",
    );

    expect(within(header).getByRole("radiogroup", { name: "Ambiente" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Alternar tema" })).toBeInTheDocument();

    await userEvent.click(within(header).getByRole("button", { name: /Ana Dona/ }));

    expect(within(header).getByText("Dono")).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "Minha conta" })).toHaveAttribute(
      "href",
      "/app/settings?tab=account",
    );
  });

  it("marksTheTestEnvironmentWithATopBorder", async () => {
    renderLayout({ environment: "TEST" });

    await screen.findByText("Loja de Dev");
    expect(screen.getByRole("banner")).toHaveClass("border-t-2", "border-warn-fg");
  });

  it("dropsTheTopBorderInLive", async () => {
    renderLayout({ environment: "LIVE" });

    await screen.findByText("Loja de Dev");
    expect(screen.getByRole("banner")).not.toHaveClass("border-t-2");
  });

  it("asksToConfirmTheEmailWhileItIsUnverified", async () => {
    renderLayout({ emailVerified: false });

    expect(await screen.findByText(/Confirme seu e-mail para ativar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar e-mail" })).toBeInTheDocument();
  });

  it("hidesTheBannerOnceVerified", async () => {
    renderLayout({ emailVerified: true });

    await screen.findByText("Loja de Dev");
    expect(screen.queryByText(/Confirme seu e-mail para ativar/)).not.toBeInTheDocument();
  });

  it("signsOutThroughTheGatewayAndLandsOnLogin", async () => {
    let loggedOut = false;
    server.use(
      http.post("http://localhost:8080/v1/auth/logout", () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderLayout();

    await userEvent.click(await screen.findByRole("button", { name: /Ana Dona/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
    expect(loggedOut).toBe(true);
    expect(router.state.location.pathname).toBe("/login");
  });
});
