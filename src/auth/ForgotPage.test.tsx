import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { ForgotPage } from "./ForgotPage";

const API = "http://localhost:8080";
const SENT = "Se este e-mail tiver conta, enviamos um link. Vale por 1 hora.";

async function askForALink(response: () => Response) {
  server.use(http.post(`${API}/v1/auth/password/forgot`, response));
  renderWithProviders([{ path: "/forgot", element: <ForgotPage /> }], {
    initialEntries: ["/forgot"],
  });
  await userEvent.type(screen.getByLabelText("E-mail"), "ana@loja.com");
  await userEvent.click(screen.getByRole("button", { name: "Enviar link" }));
}

describe("ForgotPage", () => {
  it("saysALinkMayHaveBeenSent", async () => {
    await askForALink(() => new HttpResponse(null, { status: 202 }));

    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
  });

  it("revealsNothingOnARateLimit", async () => {
    await askForALink(() =>
      HttpResponse.json(
        { type: "urn:gateway:RATE_LIMITED", status: 429, detail: "slow" },
        { status: 429 },
      ),
    );

    expect(await screen.findByText(SENT)).toBeInTheDocument();
  });
});
