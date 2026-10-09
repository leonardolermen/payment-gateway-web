import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { clearSession, readAccessToken, setAccessToken } from "./session";
import { acceptInvite, changeRole, getTeam, invite, login, logout, removeUser } from "./authApi";

const API = "http://localhost:8080";

afterEach(() => clearSession());

describe("authApi", () => {
  it("loginStoresTheAccessTokenAndSendsTheCookieJar", async () => {
    let credentials: RequestCredentials | null = null;
    server.use(
      http.post(`${API}/v1/auth/login`, ({ request }) => {
        credentials = request.credentials;
        return HttpResponse.json({ access_token: "gs_new", expires_in: 900 });
      }),
    );

    await login({ email: "ana@loja.com", password: "senha-forte-1" });

    expect(readAccessToken()).toBe("gs_new");
    expect(credentials).toBe("include");
  });

  it("logoutClearsTheSessionEvenIfTheCallFails", async () => {
    server.use(http.post(`${API}/v1/auth/logout`, () => HttpResponse.error()));
    setAccessToken("gs_x");

    await logout();

    expect(readAccessToken()).toBeNull();
  });

  it("theTeamCallsHitTheMerchantUsersAndInvitesRoutes", async () => {
    const reached: string[] = [];
    server.use(
      http.get(`${API}/v1/merchant/users`, () => {
        reached.push("list");
        return HttpResponse.json({ users: [], invites: [] });
      }),
      http.post(`${API}/v1/invites`, () => {
        reached.push("invite");
        return new HttpResponse(null, { status: 204 });
      }),
      http.patch(`${API}/v1/merchant/users/u1`, () => {
        reached.push("role");
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${API}/v1/merchant/users/u1`, () => {
        reached.push("remove");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await getTeam();
    await invite("bia@loja.com", "FINANCE");
    await changeRole("u1", "READONLY");
    await removeUser("u1");

    expect(reached).toEqual(["list", "invite", "role", "remove"]);
  });

  it("acceptInviteHitsTheSingularInviteRouteAndStoresTheToken", async () => {
    server.use(
      http.post(`${API}/v1/auth/invite/accept`, () =>
        HttpResponse.json({ access_token: "gs_inv", expires_in: 900 }),
      ),
    );

    await acceptInvite("tok", "Bia", "senha-forte-1");

    expect(readAccessToken()).toBe("gs_inv");
  });
});
