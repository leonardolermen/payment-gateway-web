import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../auth/session";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { VerifyBanner } from "./VerifyBanner";

const RESEND = "http://localhost:8080/v1/me/email/resend";

describe("VerifyBanner", () => {
  it("showsTheErrorAfterEveryFailedResend", async () => {
    let calls = 0;
    server.use(
      http.post(RESEND, () => {
        calls += 1;
        return HttpResponse.json(
          { type: "urn:gateway:RATE_LIMITED", status: 429, detail: "slow down" },
          { status: 429 },
        );
      }),
    );
    setAccessToken("gs_test");
    renderWithProviders([
      { path: "/", element: <VerifyBanner me={aMe({ emailVerified: false })} /> },
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Reenviar e-mail" }));
    const first = await screen.findByRole("alert");
    expect(first).toHaveClass("text-danger");

    await userEvent.click(screen.getByRole("button", { name: "Reenviar e-mail" }));
    await screen.findByRole("alert");

    expect(calls).toBe(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas. Aguarde um instante.");
  });
});
