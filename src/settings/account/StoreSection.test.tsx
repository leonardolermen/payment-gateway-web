import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../../auth/session";
import { aMe, mockMe } from "../../test/me";
import { server } from "../../test/msw/server";
import { renderWithProviders } from "../../test/render";
import { StoreSection } from "./StoreSection";

function renderSection(emailVerified: boolean) {
  setAccessToken("gs_test");
  mockMe(aMe({ emailVerified }));
  return renderWithProviders([{ path: "/", element: <StoreSection /> }]);
}

describe("StoreSection", () => {
  it("showsTheStoreTheEnvironmentAndAConfirmedEmail", async () => {
    renderSection(true);

    expect(await screen.findByText("Loja de Dev")).toBeInTheDocument();
    expect(screen.getByText(/não movem dinheiro/)).toBeInTheDocument();
    expect(screen.getByText("ana@loja.dev")).toBeInTheDocument();
    expect(screen.getByText("Confirmado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reenviar e-mail" })).not.toBeInTheDocument();
  });

  it("resendsTheVerificationEmail", async () => {
    let resent = false;
    server.use(
      http.post("http://localhost:8080/v1/me/email/resend", () => {
        resent = true;
        return new HttpResponse(null, { status: 202 });
      }),
    );
    renderSection(false);

    expect(await screen.findByText("Aguardando confirmação")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reenviar e-mail" }));

    expect(await screen.findByRole("button", { name: "Enviado" })).toBeDisabled();
    expect(resent).toBe(true);
  });
});
