import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../../auth/session";
import { server } from "../../test/msw/server";
import { renderWithProviders } from "../../test/render";
import { TestConnectionButton } from "./TestConnectionButton";

const TEST_URL = "http://localhost:8080/v1/merchant/providers/CIELO/test";
const CHECKED = "2026-10-09T13:00:00Z";

function renderButton(configured = true) {
  setAccessToken("gs_test");
  renderWithProviders([
    {
      path: "/",
      element: <TestConnectionButton provider="CIELO" environment="TEST" configured={configured} />,
    },
  ]);
}

async function clickTest() {
  await userEvent.click(screen.getByRole("button", { name: "Testar conexão" }));
}

describe("TestConnectionButton", () => {
  it("showsTheOkPhraseInTheOkTone", async () => {
    server.use(
      http.post(TEST_URL, () =>
        HttpResponse.json({ ok: true, detail: "Autenticado", checked_at: CHECKED }),
      ),
    );
    renderButton();

    await clickTest();

    expect(await screen.findByText("✓ Autenticado")).toHaveClass("text-ok-fg");
  });

  it("showsTheFailedPhraseInTheDangerTone", async () => {
    server.use(
      http.post(TEST_URL, () =>
        HttpResponse.json({ ok: false, detail: "401", checked_at: CHECKED }),
      ),
    );
    renderButton();

    await clickTest();

    expect(await screen.findByText("✕ 401")).toHaveClass("text-danger");
  });

  it("explainsMissingCredentials", async () => {
    server.use(
      http.post(TEST_URL, () =>
        HttpResponse.json(
          { type: "urn:gateway:PROVIDER_CREDENTIALS_MISSING", status: 404, detail: "x" },
          { status: 404 },
        ),
      ),
    );
    renderButton();

    await clickTest();

    expect(
      await screen.findByText("Configure as credenciais antes de testar."),
    ).toBeInTheDocument();
  });

  it("isDisabledUntilConfigured", () => {
    renderButton(false);

    const button = screen.getByRole("button", { name: "Testar conexão" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Salve as credenciais primeiro");
  });
});
