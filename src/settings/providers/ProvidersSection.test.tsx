import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeEnvironment } from "../../auth/environment";
import { setAccessToken } from "../../auth/session";
import { formatDateTime } from "../../support/dates";
import { aProviderStatus, anOverview } from "../../test/fixtures/providers";
import { server } from "../../test/msw/server";
import { renderWithProviders } from "../../test/render";
import { ProvidersSection } from "./ProvidersSection";
import type { ProvidersOverview } from "./types";

const API = "http://localhost:8080";
const CHECKED = "2026-10-09T13:00:00Z";

function serve(overviewFor: (environment: string) => ProvidersOverview) {
  const seen: string[] = [];
  server.use(
    http.get(`${API}/v1/merchant/providers`, ({ request }) => {
      const environment = request.headers.get("X-Environment") ?? "";
      seen.push(environment);
      return HttpResponse.json(overviewFor(environment));
    }),
  );
  return seen;
}

function renderSection() {
  setAccessToken("gs_test");
  return renderWithProviders([{ path: "/", element: <ProvidersSection /> }]);
}

describe("ProvidersSection", () => {
  it("rendersOneCardPerProvider", async () => {
    serve(() => anOverview());
    renderSection();

    expect(await screen.findByText("Pix e boleto · Itaú")).toBeInTheDocument();
    expect(screen.getByText("Cartão · Cielo")).toBeInTheDocument();
    expect(screen.getByText("Chave de notificação não definida")).toBeInTheDocument();
  });

  it("showsTheFourStateBadges", async () => {
    const configured = { configured: true, updated_at: CHECKED };
    const ok = { ok: true, detail: "ok", checked_at: CHECKED };
    const failed = { ok: false, detail: "401 do banco", checked_at: CHECKED };
    serve(() =>
      anOverview({
        providers: [
          aProviderStatus(),
          aProviderStatus({ ...configured, provider: "CIELO", methods: ["CARD"] }),
          aProviderStatus({ ...configured, last_test: ok }),
          aProviderStatus({ ...configured, last_test: failed }),
        ],
      }),
    );
    renderSection();

    expect(await screen.findByText("Não configurado")).toBeInTheDocument();
    expect(screen.getByText("Configurado, não testado")).toBeInTheDocument();
    expect(screen.getByText(`Conectado em ${formatDateTime(CHECKED)}`)).toBeInTheDocument();
    expect(screen.getByText(`Falhou em ${formatDateTime(CHECKED)}`)).toBeInTheDocument();
    expect(screen.getByText("401 do banco")).toBeInTheDocument();
  });

  it("copiesTheWebhookUrl", async () => {
    const user = userEvent.setup();
    serve(() => anOverview());
    renderSection();

    await user.click(await screen.findByRole("button", { name: "Copiar" }));

    expect(await navigator.clipboard.readText()).toBe("https://gw.example/webhooks/itau");
    expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument();
  });

  it("saysWhenTheInboundWebhookIsOff", async () => {
    serve(() => anOverview({ inbound_webhook_url: null }));
    renderSection();

    expect(await screen.findByText(/porta mTLS 0/)).toBeInTheDocument();
  });

  it("refetchesWithTheNewEnvironmentAndShowsLiveFields", async () => {
    const seen = serve((environment) =>
      anOverview({ environment: environment === "LIVE" ? "LIVE" : "TEST" }),
    );
    renderSection();
    await screen.findByText("Pix e boleto · Itaú");
    expect(screen.queryByLabelText("Certificado (.pem)")).not.toBeInTheDocument();

    act(() => storeEnvironment("LIVE"));

    expect(await screen.findByLabelText("Certificado (.pem)")).toBeInTheDocument();
    expect(seen).toEqual(["TEST", "LIVE"]);
  });
});
