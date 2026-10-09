import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { VerifyPage } from "./VerifyPage";

const API = "http://localhost:8080";

function openVerify(response: () => Response) {
  let calls = 0;
  server.use(
    http.post(`${API}/v1/auth/email/verify`, () => {
      calls += 1;
      return response();
    }),
  );
  renderWithProviders(
    [
      {
        path: "/verify/:token",
        element: (
          <StrictMode>
            <VerifyPage />
          </StrictMode>
        ),
      },
    ],
    { initialEntries: ["/verify/tok_verify"] },
  );

  return () => calls;
}

describe("VerifyPage", () => {
  it("confirmsTheEmailWithASingleCall", async () => {
    const calls = openVerify(() => new HttpResponse(null, { status: 204 }));

    expect(screen.getByText("Confirmando…")).toBeInTheDocument();
    expect(await screen.findByText("E-mail confirmado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para o painel" })).toHaveAttribute(
      "href",
      "/app/orders",
    );
    expect(calls()).toBe(1);
  });

  it("explainsAnExpiredLink", async () => {
    openVerify(() =>
      HttpResponse.json(
        { type: "urn:gateway:TOKEN_EXPIRED", status: 410, detail: "gone" },
        { status: 410 },
      ),
    );

    expect(
      await screen.findByText(
        "Este link não vale mais. Entre no painel e peça um novo e-mail de confirmação.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });
});
