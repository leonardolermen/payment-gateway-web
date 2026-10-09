import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { PemField } from "./PemField";

const PICKER = "Arquivo para Certificado";
const TEXTAREA = "Certificado";

function renderField() {
  const onChange = vi.fn();
  renderWithProviders([
    {
      path: "/",
      element: <PemField id="cert" label="Certificado" value="" onChange={onChange} />,
    },
  ]);
  return onChange;
}

function pick(file: File) {
  fireEvent.change(screen.getByLabelText(PICKER), { target: { files: [file] } });
}

describe("PemField", () => {
  it("readsAPemFileIntoTheField", async () => {
    const onChange = renderField();

    pick(new File(["-----BEGIN CERTIFICATE-----\nabc"], "cert.pem"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("-----BEGIN CERTIFICATE-----\nabc"));
    expect(screen.getByLabelText(TEXTAREA)).not.toHaveAttribute("aria-invalid");
  });

  it("rejectsAFileThatDoesNotLookLikeAPem", async () => {
    const onChange = renderField();

    pick(new File(["MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB"], "cert.der"));

    expect(await screen.findByText("Arquivo não parece um PEM")).toBeInTheDocument();
    expect(screen.getByLabelText(TEXTAREA)).toHaveAttribute("aria-invalid", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejectsAFileOver64Kb", async () => {
    const onChange = renderField();

    pick(new File(["-----BEGIN CERTIFICATE-----".padEnd(64 * 1024 + 1, "x")], "big.pem"));

    expect(await screen.findByText("Arquivo muito grande (máx. 64 KB)")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("aGoodFileClearsAnEarlierRejection", async () => {
    renderField();
    pick(new File(["nope"], "cert.der"));
    await screen.findByText("Arquivo não parece um PEM");

    pick(new File(["-----BEGIN CERTIFICATE-----"], "cert.pem"));

    await waitFor(() =>
      expect(screen.queryByText("Arquivo não parece um PEM")).not.toBeInTheDocument(),
    );
  });
});
