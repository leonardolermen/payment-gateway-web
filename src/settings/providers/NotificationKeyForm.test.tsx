import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../../auth/session";
import { server } from "../../test/msw/server";
import { renderWithProviders } from "../../test/render";
import { NotificationKeyForm } from "./NotificationKeyForm";

const KEY_URL = "http://localhost:8080/v1/merchant/providers/CIELO/notification-key";

describe("NotificationKeyForm", () => {
  it("sendsTheKeyAndClearsTheInput", async () => {
    let body: unknown = null;
    server.use(
      http.put(KEY_URL, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    setAccessToken("gs_test");
    renderWithProviders([
      { path: "/", element: <NotificationKeyForm environment="TEST" keySet={false} /> },
    ]);

    await userEvent.type(screen.getByLabelText("Chave de notificação"), "k-1");
    await userEvent.click(screen.getByRole("button", { name: "Salvar chave" }));

    expect(await screen.findByText("Chave salva")).toBeInTheDocument();
    expect(body).toEqual({ key: "k-1" });
    expect(screen.getByLabelText("Chave de notificação")).toHaveValue("");
  });
});
