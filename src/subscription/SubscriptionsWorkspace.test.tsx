import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { setAccessToken } from "../auth/session";
import { aPlan } from "../test/fixtures/plans";
import { aSubscription } from "../test/fixtures/subscriptions";
import { aMe } from "../test/me";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { NoSubscriptionSelected } from "./NoSubscriptionSelected";
import { SubscriptionsWorkspace } from "./SubscriptionsWorkspace";

const API = "http://localhost:8080/v1";

// Mirrors the app's routes until Task 6: the detail path still shows the hint.
function renderWorkspace(path: string) {
  setAccessToken("gs_test");
  server.use(
    http.get(`${API}/subscriptions`, () => HttpResponse.json([aSubscription({ id: "sub_a" })])),
    http.get(`${API}/plans/:id`, () => HttpResponse.json(aPlan())),
  );
  return renderWithProviders(
    [
      {
        path: "/app/subscriptions",
        element: <SubscriptionsWorkspace />,
        children: [
          { index: true, element: <NoSubscriptionSelected /> },
          { path: ":id", element: <NoSubscriptionSelected /> },
        ],
      },
    ],
    { initialEntries: [path], me: aMe({ role: "OWNER" }) },
  );
}

describe("SubscriptionsWorkspace", () => {
  it("showsTheListAndAHintBeforeASubscriptionIsChosen", async () => {
    renderWorkspace("/app/subscriptions");

    expect(screen.getByRole("heading", { name: "Assinaturas" })).toBeInTheDocument();
    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText(/Escolha uma assinatura na lista/)).toBeInTheDocument();
  });

  it("aSubscriptionInTheUrlMarksItsRow", async () => {
    renderWorkspace("/app/subscriptions/sub_a");

    await screen.findByText("Maria Souza");
    expect(screen.getAllByRole("row")[1]).toHaveAttribute("data-selected", "true");
  });
});
