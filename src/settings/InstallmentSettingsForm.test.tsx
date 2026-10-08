import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { InstallmentSettingsForm } from "./InstallmentSettingsForm";

const current = {
  environment: "TEST",
  max_installments: 12,
  interest_free_up_to: 3,
  monthly_rate_bps: 299,
  updated_at: "2026-10-01T12:00:00Z",
};

function renderForm() {
  storeApiKey("gk_test_abc");
  server.use(
    http.get("http://localhost:8080/v1/installment-settings", () => HttpResponse.json(current)),
  );
  return renderWithProviders([{ path: "/", element: <InstallmentSettingsForm /> }]);
}

describe("InstallmentSettingsForm", () => {
  it("loadsTheCurrentValuesAndPreviewsThem", async () => {
    renderForm();

    expect(await screen.findByLabelText("Máximo de parcelas")).toHaveValue(12);
    expect(screen.getByLabelText("Sem juros até")).toHaveValue(3);
    expect(screen.getByLabelText("Juros ao mês (%)")).toHaveValue("2,99");

    // The sample starts at R$ 1.000,00; the gateway's vectors are for R$ 100,00.
    const sample = screen.getByLabelText("Valor");
    await userEvent.clear(sample);
    await userEvent.type(sample, "100");

    const preview = screen.getByRole("table", { name: "Prévia das parcelas" });
    // 10000 cents, free up to 3, 2.99%: the gateway's own vector for 4x.
    expect(within(preview).getByText("4x de R$ 26,90")).toBeInTheDocument();
    expect(within(preview).getByText("R$ 107,60")).toBeInTheDocument();
    expect(within(preview).getByText("3x de R$ 33,33")).toBeInTheDocument();
  });

  it("sendsBpsAndShowsTheSavedState", async () => {
    let sent: unknown = null;
    server.use(
      http.put("http://localhost:8080/v1/installment-settings", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          ...current,
          monthly_rate_bps: 150,
          updated_at: "2026-10-08T10:00:00Z",
        });
      }),
    );
    renderForm();
    const rate = await screen.findByLabelText("Juros ao mês (%)");

    await userEvent.clear(rate);
    await userEvent.type(rate, "1,5");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(/Salvo/)).toBeInTheDocument();
    expect(sent).toEqual({ max_installments: 12, interest_free_up_to: 3, monthly_rate_bps: 150 });
  });

  it("freeUpToAboveMaxIsRefusedLocally", async () => {
    let called = false;
    server.use(
      http.put("http://localhost:8080/v1/installment-settings", () => {
        called = true;
        return HttpResponse.json(current);
      }),
    );
    renderForm();
    const freeUpTo = await screen.findByLabelText("Sem juros até");

    await userEvent.clear(freeUpTo);
    await userEvent.type(freeUpTo, "13");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Não pode passar do máximo de parcelas.")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("aGatewayValidationErrorLandsAtTheTop", async () => {
    server.use(
      http.put("http://localhost:8080/v1/installment-settings", () =>
        HttpResponse.json(
          {
            type: "urn:gateway:INVALID_REQUEST",
            status: 400,
            detail: "monthly_rate_bps must be between 0 and 1000",
          },
          { status: 400 },
        ),
      ),
    );
    renderForm();
    await screen.findByLabelText("Máximo de parcelas");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Requisição inválida.");
  });
});
