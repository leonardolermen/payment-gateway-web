import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { Environment } from "../../auth/environment";
import { setAccessToken } from "../../auth/session";
import { server } from "../../test/msw/server";
import { renderWithProviders } from "../../test/render";
import { CredentialForm } from "./CredentialForm";

const CREDENTIALS_URL = "http://localhost:8080/v1/merchant/providers/ITAU/credentials";
const STORED = {
  client_id: "cid",
  pix_key: "old@pix",
  beneficiary_id: "ben",
  wallet_code: "109",
  species_code: "01",
};

function captureBody(respond: () => Response = () => new HttpResponse(null, { status: 204 })) {
  const sent: { body: unknown } = { body: null };
  server.use(
    http.put(CREDENTIALS_URL, async ({ request }) => {
      sent.body = await request.json();
      return respond();
    }),
  );
  return sent;
}

function renderForm(environment: Environment = "TEST", stored: Record<string, string> = STORED) {
  setAccessToken("gs_test");
  const onSaved = vi.fn();
  renderWithProviders([
    {
      path: "/",
      element: (
        <CredentialForm
          provider="ITAU"
          environment={environment}
          storedFields={stored}
          secretsSet={{ client_secret: true }}
          onSaved={onSaved}
        />
      ),
    },
  ]);
  return onSaved;
}

function invalid(field: string) {
  return HttpResponse.json(
    { type: "urn:gateway:PROVIDER_CREDENTIALS_INVALID", status: 422, detail: "bad", field },
    { status: 422 },
  );
}

async function save() {
  await userEvent.click(screen.getByRole("button", { name: "Salvar credenciais" }));
}

describe("CredentialForm", () => {
  it("prefillsPublicFieldsFromTheGet", () => {
    renderForm();

    expect(screen.getByLabelText("Chave Pix recebedora")).toHaveValue("old@pix");
    expect(screen.getByLabelText("Client ID")).toHaveValue("cid");
    expect(screen.getByLabelText("Client secret")).toHaveValue("");
  });

  it("prefillsDefaultsWhenNothingIsStored", () => {
    renderForm("TEST", {});

    expect(screen.getByLabelText("Carteira")).toHaveValue("109");
  });

  it("sendsOnlyWhatWasTypedAndForgetsSecretsAfterSaving", async () => {
    const sent = captureBody();
    const onSaved = renderForm();

    await userEvent.clear(screen.getByLabelText("Chave Pix recebedora"));
    await userEvent.type(screen.getByLabelText("Chave Pix recebedora"), "new@pix");
    await userEvent.type(screen.getByLabelText("Client secret"), "s3cret");
    await save();

    expect(await screen.findByText("Credenciais salvas")).toBeInTheDocument();
    expect(sent.body).toEqual({
      payload: { ...STORED, pix_key: "new@pix", client_secret: "s3cret" },
    });
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByLabelText("Client secret")).toHaveValue("");
    expect(screen.getByLabelText("Client secret")).toHaveAttribute("placeholder", "•••• definido");
  });

  it("removingASecretSendsAnEmptyString", async () => {
    const sent = captureBody();
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Remover Client secret" }));
    await save();

    await waitFor(() => expect(sent.body).toEqual({ payload: { ...STORED, client_secret: "" } }));
  });

  it("keepUndoesTheRemoval", async () => {
    const sent = captureBody();
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Remover Client secret" }));
    await userEvent.click(screen.getByRole("button", { name: "Manter Client secret" }));
    await save();

    await waitFor(() => expect(sent.body).toEqual({ payload: STORED }));
  });

  it("a422LandsOnItsField", async () => {
    captureBody(() => invalid("pix_key"));
    renderForm();

    await save();

    expect(await screen.findByText("Credencial inválida.")).toBeInTheDocument();
    expect(screen.getByLabelText("Chave Pix recebedora")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a422OnAnUnknownFieldBecomesTheFormAlert", async () => {
    captureBody(() => invalid("mystery"));
    renderForm();

    await save();

    expect(await screen.findByRole("alert")).toHaveTextContent("Credencial inválida.");
  });

  it("thePemPickerFillsTheTextarea", async () => {
    renderForm("LIVE");
    const file = new File(["-----BEGIN CERTIFICATE-----"], "cert.pem");

    fireEvent.change(screen.getByLabelText("Arquivo para Certificado (.pem)"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Certificado (.pem)")).toHaveValue(
        "-----BEGIN CERTIFICATE-----",
      ),
    );
  });

  it("liveShowsTheCertificateAndThePrivateKey", () => {
    renderForm("LIVE");

    expect(screen.getByLabelText("Certificado (.pem)")).toBeInTheDocument();
    expect(screen.getByLabelText("Chave privada (.pem)")).toBeInTheDocument();
  });
});
