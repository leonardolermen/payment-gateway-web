import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../auth/session";
import { mockMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("showsTheStoreAndTheEnvironment", async () => {
    setAccessToken("gs_test");
    mockMe();
    renderWithProviders([{ path: "/app/settings", element: <SettingsPage /> }], {
      initialEntries: ["/app/settings"],
    });

    expect(await screen.findByText("Loja de Dev")).toBeInTheDocument();
    expect(screen.getByText(/não movem dinheiro/)).toBeInTheDocument();
  });

  it("switchesToTheInstallmentsTab", async () => {
    setAccessToken("gs_test");
    mockMe();
    server.use(
      http.get("http://localhost:8080/v1/installment-settings", () =>
        HttpResponse.json({
          environment: "LIVE",
          max_installments: 6,
          interest_free_up_to: 6,
          monthly_rate_bps: 0,
          updated_at: "2026-10-01T12:00:00Z",
        }),
      ),
    );
    renderWithProviders([{ path: "/app/settings", element: <SettingsPage /> }], {
      initialEntries: ["/app/settings"],
    });

    await userEvent.click(await screen.findByRole("tab", { name: "Parcelamento" }));

    expect(await screen.findByLabelText("Máximo de parcelas")).toHaveValue(6);
  });
});
