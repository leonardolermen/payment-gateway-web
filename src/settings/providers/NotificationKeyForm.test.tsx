import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../../auth/session";
import { server } from "../../test/msw/server";
import { renderWithProviders } from "../../test/render";
import { NotificationKeyForm } from "./NotificationKeyForm";

const KEY_URL = "http://localhost:8080/v1/merchant/providers/CIELO/notification-key";

function renderForm() {
  setAccessToken("gs_test");
  renderWithProviders([
    { path: "/", element: <NotificationKeyForm environment="TEST" keySet={false} /> },
  ]);
}

function problem(status: number, code: string, field?: string) {
  return HttpResponse.json(
    { type: `urn:gateway:${code}`, status, detail: "bad", field },
    { status },
  );
}

async function typeAndSave(key = "k-1") {
  await userEvent.type(screen.getByLabelText("Chave de notificação"), key);
  await userEvent.click(screen.getByRole("button", { name: "Salvar chave" }));
}

describe("NotificationKeyForm", () => {
  it("sendsTheKeyAndClearsTheInput", async () => {
    let body: unknown = null;
    server.use(
      http.put(KEY_URL, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderForm();

    await typeAndSave();

    expect(await screen.findByText("Chave salva")).toBeInTheDocument();
    expect(body).toEqual({ key: "k-1" });
    expect(screen.getByLabelText("Chave de notificação")).toHaveValue("");
  });

  it("a422OnTheKeyLandsOnTheInput", async () => {
    server.use(http.put(KEY_URL, () => problem(422, "PROVIDER_CREDENTIALS_INVALID", "key")));
    renderForm();

    await typeAndSave();

    const input = await screen.findByLabelText("Chave de notificação");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Credencial inválida.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("anyOtherErrorBecomesTheAlert", async () => {
    server.use(http.put(KEY_URL, () => problem(403, "FORBIDDEN_FOR_ROLE")));
    renderForm();

    await typeAndSave();

    expect(await screen.findByRole("alert")).toHaveTextContent("Seu papel não permite esta ação.");
    expect(screen.getByLabelText("Chave de notificação")).not.toHaveAttribute("aria-invalid");
  });
});
