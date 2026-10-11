# Panel as a Product, part 4: account, environment, team — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The panel logs in with e-mail and password against the gateway's B3 (`payment-gateway#33`): signup, verification, password reset, invites, a TEST/LIVE switch in the header, roles that hide what a user may not do, and a Settings area for the account and the team. The API key leaves the browser.

**Architecture:** `auth/session.ts` holds the access token in memory and the chosen environment in `localStorage`; `support/merchantRequest.ts` stays the only place that puts headers on panel calls (`Authorization: Bearer gs_…`, `X-Environment`) and now refreshes once on 401 via the HttpOnly cookie (`POST /v1/auth/refresh` with `credentials: "include"`). `RequireSession` bootstraps that refresh before rendering `/app`. `auth/permissions.ts` is the one table every action button consults. Pages are small concept folders: `auth/` (login, signup, forgot, reset, verify, invite), `settings/account/`, `settings/team/`.

**Tech Stack:** React 19, TypeScript strict, React Router 7, TanStack Query 5, Tailwind 4, Vitest + Testing Library + MSW 2.

**Spec:** `docs/superpowers/specs/2026-10-08-produto-completo-design.md` §1, §2 (environment switch only — the dashboard is F6), §8 (Conta, Equipe, Minha conta only), §10.

## Global Constraints

- Identifiers, comments, commit subjects in English; screen copy in pt-BR. Comments explain why. No `any`. One component per file; a file over ~200 lines is split. Folders are concepts.
- Red first; before each commit `pnpm test && pnpm typecheck && pnpm lint` green; `pnpm prettier --write` on the files touched; commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Secrets:** the access token lives only in a module variable (`auth/session.ts`), never in `localStorage`/`sessionStorage`, never in a query key, URL or log. The refresh token is a cookie the browser owns; the app never reads it. Passwords live in form state only and are cleared after the request. The API key (`gk_`) is gone from the panel: `auth/apiKey.ts` and the key login are deleted.
- API contract (gateway branch `feat/users-and-sessions`, snake_case JSON, RFC 9457 problems with `type: "urn:gateway:<CODE>"`):
  - `POST /v1/auth/signup {store_name, name, email, password}` → 201 `{access_token, expires_in}` + `Set-Cookie gw_refresh` (`Path=/v1/auth`); 409 `EMAIL_TAKEN`; 422 `WEAK_PASSWORD` (< 10 chars).
  - `POST /v1/auth/login {email, password}` → 200 same shape; 401 `INVALID_CREDENTIALS`; 503 `AUTH_BUSY`; 429 `RATE_LIMITED`.
  - `POST /v1/auth/refresh` (cookie only) → 200 same shape, cookie rotated; 401 `SESSION_EXPIRED`.
  - `POST /v1/auth/logout` → 204, cookie cleared. `POST /v1/auth/password/forgot {email}` → 202 always. `POST /v1/auth/password/reset {token, password}` → 204; 410 `TOKEN_EXPIRED`; 422 `WEAK_PASSWORD`. `POST /v1/auth/email/verify {token}` → 204; 410. `POST /v1/auth/invite/accept {token, name, password}` → 201 session; 410; 409; 422.
  - All `/v1/auth/*` calls need `credentials: "include"` (the cookie) and no `Authorization`; nothing else does.
  - Panel calls: `Authorization: Bearer <access_token>` and `X-Environment: TEST|LIVE` (anything else is TEST; `LIVE` with an unverified e-mail → 403 `EMAIL_NOT_VERIFIED`). 401 `SESSION_EXPIRED` means refresh then retry once; a second 401 means log in again.
  - `GET /v1/me → {user:{id, name, email, role: OWNER|FINANCE|READONLY, email_verified}, merchant:{id, name}, onboarding:{email_verified, live_enabled}}`; `PATCH /v1/me {name}` → 200 same; `POST /v1/me/password {current, new}` → 204 / 401 `INVALID_CREDENTIALS` / 422; `POST /v1/me/email/resend` → 202 / 409 `ALREADY_VERIFIED` / 429 `RESEND_TOO_SOON`; `GET /v1/me/sessions → [{id, ip, user_agent, created_at, last_used_at, current}]`; `DELETE /v1/me/sessions/others` → 204.
  - `GET /v1/merchant/users → {users:[{id, name, email, role, last_login_at}], invites:[{email, role, expires_at}]}`; `POST /v1/invites {email, role}` → 202 / 409 `EMAIL_TAKEN` / 403 `EMAIL_NOT_VERIFIED`; `PATCH /v1/merchant/users/{id} {role}` → 200; `DELETE /v1/merchant/users/{id}` → 204; own account → 400 `OWN_ACCOUNT`; other store's user → 404. Team routes need OWNER (403 `FORBIDDEN_FOR_ROLE` + `required_role` otherwise).
  - `GET /v1/merchant → {merchant_id, name, environment}` still works with a session (environment = the `X-Environment` sent).
- **Roles → actions** (spec §1 table): READONLY sees everything; FINANCE creates charges/customers/plans/subscriptions, cancels, refunds, captures; OWNER additionally: webhooks, API keys, providers, installment settings, team, store data, delete customer. Buttons without permission do **not** render (not disabled).
- Environment switch: `localStorage["gateway.environment"]` (`TEST` default) — a per-viewer convenience, not a secret; wrapped in try/catch like `theme.ts`. Changing it clears the query cache (every list is per environment). LIVE option disabled with a title when `!email_verified`.
- Routes: `/login`, `/signup`, `/forgot`, `/reset/:token`, `/verify/:token`, `/invite/:token` outside `/app`; `/app/login` redirects to `/login`. Existing `?next=` behaviour kept (same-origin paths only).

## Review Focus

1. A 401 on any panel call must trigger exactly one refresh and one retry; a 401 from the refresh itself must end at `/login?next=…` with the cache cleared and no retry loop — pinned in Task 1 (`merchantRequest.test.ts: aStaleAccessTokenRefreshesOnceAndRetries`, `aDeadRefreshGoesToLoginWithoutLooping`).
2. The access token must never land in storage or in the TanStack cache — pinned in Task 1 (`session.test.ts: theAccessTokenNeverTouchesStorage`) and Task 3 (`RequireSession.test.tsx` asserting `localStorage`/`sessionStorage` hold no `gs_`).
3. Switching to LIVE while unverified must be impossible from the UI, and a `403 EMAIL_NOT_VERIFIED` arriving anyway must fall back to TEST with a message, not strand the user — pinned in Task 3 (`EnvironmentSwitch.test.tsx`).
4. A READONLY user must see no create/cancel/refund button on orders, customers, plans; a FINANCE user must see none of the Settings › Equipe/Parcelamento tabs — pinned in Task 6 (`permissions.test.ts` table + per-screen tests).
5. Passwords typed into any form must be cleared after the request and never appear in the URL — pinned in Task 4 (`passwordsNeverPersist.test.tsx`, modelled on `checkout/cardDataNeverPersists.test.tsx`).

---

### Task 1: Session store, environment store, and `merchantRequest` with refresh-once

**Files:**
- Create: `src/auth/session.ts`, `src/auth/session.test.ts`, `src/auth/environment.ts`, `src/auth/environment.test.ts`
- Modify: `src/support/http.ts` (`credentials?: "include"` in `Init`), `src/support/merchantRequest.ts`, `src/support/merchantRequest.test.ts` (create if absent)
- Delete: `src/auth/apiKey.ts`, `src/auth/apiKey.test.ts` (Task 3 removes their last callers; delete there if the build needs them until then — see Task 3)

**Interfaces:**
- Produces:
  - `session.ts`: `setAccessToken(token: string | null)`, `readAccessToken(): string | null`, `clearSession()` (token → null). Module state only.
  - `environment.ts`: `type Environment = "TEST" | "LIVE"`; `readEnvironment(): Environment` (localStorage, default TEST, try/catch); `storeEnvironment(env)`; `ENVIRONMENT_KEY = "gateway.environment"`.
  - `http.ts` `Init` gains `credentials?: "include"` passed to `fetch`.
  - `merchantRequest.ts`: `merchantRequest<T>(path, init)` attaches `Authorization: Bearer <access>` (when present) and `X-Environment: <readEnvironment()>`; on `GatewayRequestError` 401 it calls `refreshSession()` once and retries once; if the refresh fails (any error) it `clearSession()`, notifies `onUnauthenticated` listeners and throws `Unauthenticated`. `refreshSession(): Promise<boolean>` = `POST /v1/auth/refresh` with `credentials: "include"`, stores the new access token, `true` on success. Concurrent 401s share one in-flight refresh promise (a module-level `refreshing: Promise<boolean> | null`).
  - `onUnauthenticated`/`Unauthenticated` unchanged.

- [ ] **Step 1: Failing tests**

```ts
// src/auth/session.test.ts
import { describe, expect, it } from "vitest";
import { clearSession, readAccessToken, setAccessToken } from "./session";

describe("session", () => {
  it("theAccessTokenNeverTouchesStorage", () => {
    setAccessToken("gs_abc");

    expect(readAccessToken()).toBe("gs_abc");
    expect(JSON.stringify(window.localStorage)).not.toContain("gs_abc");
    expect(JSON.stringify(window.sessionStorage)).not.toContain("gs_abc");

    clearSession();
    expect(readAccessToken()).toBeNull();
  });
});
```
```ts
// src/auth/environment.test.ts
import { describe, expect, it } from "vitest";
import { ENVIRONMENT_KEY, readEnvironment, storeEnvironment } from "./environment";

describe("environment", () => {
  it("defaultsToTestAndRemembersLive", () => {
    expect(readEnvironment()).toBe("TEST");
    storeEnvironment("LIVE");
    expect(window.localStorage.getItem(ENVIRONMENT_KEY)).toBe("LIVE");
    expect(readEnvironment()).toBe("LIVE");
  });

  it("anythingElseInStorageReadsAsTest", () => {
    window.localStorage.setItem(ENVIRONMENT_KEY, "live");
    expect(readEnvironment()).toBe("TEST");
  });
});
```
```ts
// src/support/merchantRequest.test.ts
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, readAccessToken, setAccessToken } from "../auth/session";
import { storeEnvironment } from "../auth/environment";
import { server } from "../test/msw/server";
import { merchantRequest, onUnauthenticated, Unauthenticated } from "./merchantRequest";

const API = "http://localhost:8080";
const expired = () =>
  HttpResponse.json({ type: "urn:gateway:SESSION_EXPIRED", status: 401, detail: "x" }, { status: 401 });

afterEach(() => clearSession());

describe("merchantRequest", () => {
  it("sendsTheBearerAndTheEnvironment", async () => {
    setAccessToken("gs_one");
    storeEnvironment("LIVE");
    let seen: Headers | null = null;
    server.use(http.get(`${API}/v1/orders`, ({ request }) => { seen = request.headers; return HttpResponse.json([]); }));

    await merchantRequest("/v1/orders");

    expect(seen!.get("authorization")).toBe("Bearer gs_one");
    expect(seen!.get("x-environment")).toBe("LIVE");
  });

  it("aStaleAccessTokenRefreshesOnceAndRetries", async () => {
    setAccessToken("gs_stale");
    const bearers: (string | null)[] = [];
    let refreshCalls = 0;
    server.use(
      http.get(`${API}/v1/orders`, ({ request }) => {
        bearers.push(request.headers.get("authorization"));
        return request.headers.get("authorization") === "Bearer gs_fresh" ? HttpResponse.json([{ id: "o1" }]) : expired();
      }),
      http.post(`${API}/v1/auth/refresh`, ({ request }) => {
        refreshCalls += 1;
        expect(request.credentials).toBe("include");
        return HttpResponse.json({ access_token: "gs_fresh", expires_in: 900 });
      }),
    );

    const { data } = await merchantRequest<{ id: string }[]>("/v1/orders");

    expect(data).toEqual([{ id: "o1" }]);
    expect(bearers).toEqual(["Bearer gs_stale", "Bearer gs_fresh"]);
    expect(refreshCalls).toBe(1);
    expect(readAccessToken()).toBe("gs_fresh");
  });

  it("aDeadRefreshGoesToLoginWithoutLooping", async () => {
    setAccessToken("gs_stale");
    let orderCalls = 0;
    const listener = vi.fn();
    const off = onUnauthenticated(listener);
    server.use(
      http.get(`${API}/v1/orders`, () => { orderCalls += 1; return expired(); }),
      http.post(`${API}/v1/auth/refresh`, () => expired()),
    );

    await expect(merchantRequest("/v1/orders")).rejects.toBeInstanceOf(Unauthenticated);

    expect(orderCalls).toBe(1);
    expect(readAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("concurrent401sShareOneRefresh", async () => {
    setAccessToken("gs_stale");
    let refreshCalls = 0;
    server.use(
      http.get(`${API}/v1/orders`, ({ request }) => request.headers.get("authorization") === "Bearer gs_fresh" ? HttpResponse.json([]) : expired()),
      http.get(`${API}/v1/customers`, ({ request }) => request.headers.get("authorization") === "Bearer gs_fresh" ? HttpResponse.json([]) : expired()),
      http.post(`${API}/v1/auth/refresh`, async () => { refreshCalls += 1; await new Promise((r) => setTimeout(r, 20)); return HttpResponse.json({ access_token: "gs_fresh", expires_in: 900 }); }),
    );

    await Promise.all([merchantRequest("/v1/orders"), merchantRequest("/v1/customers")]);

    expect(refreshCalls).toBe(1);
  });
});
```
Run: `pnpm vitest run src/auth/session.test.ts src/auth/environment.test.ts src/support/merchantRequest.test.ts` → Expected: FAIL (modules missing / old behaviour).

- [ ] **Step 2: Implement**

```ts
// src/auth/session.ts
// Memory only: an access token in storage would survive the tab and be readable by any script.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function readAccessToken(): string | null {
  return accessToken;
}

export function clearSession(): void {
  accessToken = null;
}
```
```ts
// src/auth/environment.ts
export type Environment = "TEST" | "LIVE";

export const ENVIRONMENT_KEY = "gateway.environment";

// A per-viewer convenience, not a secret: which environment the panel shows. Guarded like theme.ts,
// because private modes throw instead of returning null.
export function readEnvironment(): Environment {
  try {
    return window.localStorage.getItem(ENVIRONMENT_KEY) === "LIVE" ? "LIVE" : "TEST";
  } catch {
    return "TEST";
  }
}

export function storeEnvironment(environment: Environment): void {
  try {
    window.localStorage.setItem(ENVIRONMENT_KEY, environment);
  } catch {
    // Without storage the choice simply does not survive a reload.
  }
}
```
`http.ts`: add `credentials?: "include"` to `Init` and pass `credentials: init.credentials` to `fetch`.
```ts
// src/support/merchantRequest.ts
import { readEnvironment } from "../auth/environment";
import { clearSession, readAccessToken, setAccessToken } from "../auth/session";
import { GatewayRequestError } from "./gatewayError";
import { request } from "./http";

type Init = Omit<NonNullable<Parameters<typeof request>[1]>, "apiKey" | "credentials">;

export class Unauthenticated extends Error {
  constructor() {
    super("unauthenticated");
  }
}

const listeners = new Set<() => void>();

export function onUnauthenticated(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// One refresh at a time: ten lists failing together must not rotate the cookie ten times.
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshing ??= request<{ access_token: string }>("/v1/auth/refresh", { method: "POST", credentials: "include" })
    .then(({ data }) => {
      setAccessToken(data.access_token);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// The ONLY way panel code talks to the API: it attaches the session and the environment, refreshes
// once on a 401, and turns a second 401 into "go back to login". `request` stays for the public
// checkout and for /v1/auth, which carry no session.
export async function merchantRequest<T>(path: string, init: Init = {}): Promise<{ data: T; headers: Headers }> {
  try {
    return await send<T>(path, init);
  } catch (e) {
    if (!isUnauthorized(e)) {
      throw e;
    }
  }

  if (await refreshSession()) {
    try {
      return await send<T>(path, init);
    } catch (e) {
      if (!isUnauthorized(e)) {
        throw e;
      }
    }
  }

  clearSession();
  listeners.forEach((listener) => listener());
  throw new Unauthenticated();
}

function send<T>(path: string, init: Init) {
  const access = readAccessToken();
  return request<T>(path, {
    ...init,
    headers: { ...init.headers, "X-Environment": readEnvironment(), ...(access ? { Authorization: `Bearer ${access}` } : {}) },
  });
}

function isUnauthorized(e: unknown): boolean {
  return e instanceof GatewayRequestError && e.error.status === 401;
}
```
`http.ts` currently sets `Authorization` only from `apiKey`; headers passed via `init.headers` already reach `fetch`, so the bearer goes through `headers`. Keep `apiKey` in `http.ts` for now (the checkout does not use it either; remove it in Task 3 with `apiKey.ts`).

Run the three test files → PASS. `pnpm typecheck` will fail on `apiKey` imports in `RequireApiKey`, `LoginPage`, `AccountSection`, `AppLayout`, tests — leave `apiKey.ts` in place until Task 3 and keep `readApiKey()` out of `merchantRequest`. Full `pnpm test` must stay green: existing tests that `storeApiKey("gk_…")` and expect `Authorization: Bearer gk_…` on panel calls (`OrdersList.test`, `AppLayout.test`, …) will now send no bearer — MSW handlers in those tests do not assert the header except `LoginPage.test` (`authorization` of `/v1/merchant` on login, which uses `request` with `apiKey`, unaffected). Run `pnpm test` and fix any test that asserted the key header on a panel call by switching it to `setAccessToken("gs_test")` — list each in the report.

- [ ] **Step 3: Commit**

```bash
git add src/auth/session.ts src/auth/session.test.ts src/auth/environment.ts src/auth/environment.test.ts src/support/http.ts src/support/merchantRequest.ts src/support/merchantRequest.test.ts
git commit -m "feat(auth): session in memory, environment in storage, and a refresh-once merchantRequest"
```

---

### Task 2: Auth API, `useMe`, and the permissions table

**Files:**
- Create: `src/auth/authApi.ts`, `src/auth/types.ts`, `src/auth/useMe.ts`, `src/auth/permissions.ts`, `src/auth/permissions.test.ts`, `src/auth/authApi.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `Role = "OWNER" | "FINANCE" | "READONLY"`; `Me = { user: { id; name; email; role: Role; email_verified: boolean }; merchant: { id; name }; onboarding: { email_verified: boolean; live_enabled: boolean } }`; `SessionSummary = { id; ip: string | null; user_agent: string | null; created_at; last_used_at; current: boolean }`; `TeamMember = { id; name; email; role: Role; last_login_at: string | null }`; `PendingInvite = { email; role: Role; expires_at }`; `Team = { users: TeamMember[]; invites: PendingInvite[] }`.
  - `authApi.ts` (all via `request` with `credentials: "include"`, storing the access token on success): `signup({store_name, name, email, password})`, `login({email, password})`, `logout()` (then `clearSession()`), `forgotPassword(email)`, `resetPassword(token, password)`, `verifyEmail(token)`, `acceptInvite(token, name, password)`. Via `merchantRequest`: `getMe()`, `renameMe(name)`, `changePassword(current, next)`, `resendVerification()`, `listSessions()`, `revokeOtherSessions()`, `getTeam()`, `invite(email, role)`, `changeRole(id, role)`, `removeUser(id)`. Keys: `meKeys = { me: ["me"], sessions: ["me","sessions"], team: ["team"] }`.
  - `useMe()` = `useQuery({ queryKey: meKeys.me, queryFn: getMe, staleTime: 60_000 })`.
  - `permissions.ts`: `type Action = "create_charge" | "cancel" | "refund" | "capture" | "create_customer" | "delete_customer" | "create_plan" | "edit_plan" | "create_subscription" | "webhooks" | "api_keys" | "providers" | "installments" | "team" | "store"`; `can(role: Role, action: Action): boolean` from a declarative `Record<Action, Role>` of the minimum role with `OWNER > FINANCE > READONLY`.
  - `gatewayError.ts` MESSAGES gains: `EMAIL_TAKEN` "Este e-mail já tem conta.", `WEAK_PASSWORD` "A senha precisa ter pelo menos 10 caracteres.", `INVALID_CREDENTIALS` "E-mail ou senha incorretos.", `SESSION_EXPIRED` "Sua sessão expirou. Entre de novo.", `TOKEN_EXPIRED` "Este link não vale mais.", `ALREADY_VERIFIED` "Seu e-mail já está confirmado.", `RESEND_TOO_SOON` "Aguarde alguns minutos antes de reenviar.", `AUTH_BUSY` "Muita gente entrando agora. Tente em instantes.", `EMAIL_NOT_VERIFIED` "Confirme seu e-mail para usar produção.", `FORBIDDEN_FOR_ROLE` "Seu papel não permite esta ação.", `LAST_OWNER` "A loja precisa de pelo menos um dono.", `OWN_ACCOUNT` "Use Minha conta para a sua própria conta.", `ORIGIN_NOT_ALLOWED` "Origem não permitida."

- [ ] **Step 1: Failing tests**

```ts
// src/auth/permissions.test.ts
import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("can", () => {
  it("readonlySeesEverythingAndDoesNothing", () => {
    expect(can("READONLY", "create_charge")).toBe(false);
    expect(can("READONLY", "refund")).toBe(false);
    expect(can("READONLY", "team")).toBe(false);
  });

  it("financeOperatesButDoesNotConfigure", () => {
    expect(can("FINANCE", "create_charge")).toBe(true);
    expect(can("FINANCE", "refund")).toBe(true);
    expect(can("FINANCE", "capture")).toBe(true);
    expect(can("FINANCE", "create_plan")).toBe(true);
    expect(can("FINANCE", "delete_customer")).toBe(false);
    expect(can("FINANCE", "installments")).toBe(false);
    expect(can("FINANCE", "team")).toBe(false);
    expect(can("FINANCE", "webhooks")).toBe(false);
  });

  it("ownerDoesEverything", () => {
    for (const action of ["create_charge", "delete_customer", "team", "store", "api_keys", "providers"] as const) {
      expect(can("OWNER", action)).toBe(true);
    }
  });
});
```
```ts
// src/auth/authApi.test.ts
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { clearSession, readAccessToken } from "./session";
import { login, logout } from "./authApi";

const API = "http://localhost:8080";
afterEach(() => clearSession());

describe("authApi", () => {
  it("loginStoresTheAccessTokenAndSendsTheCookieJar", async () => {
    let credentials: RequestCredentials | null = null;
    server.use(http.post(`${API}/v1/auth/login`, ({ request }) => { credentials = request.credentials; return HttpResponse.json({ access_token: "gs_new", expires_in: 900 }); }));

    await login({ email: "ana@loja.com", password: "senha-forte-1" });

    expect(readAccessToken()).toBe("gs_new");
    expect(credentials).toBe("include");
  });

  it("logoutClearsTheSessionEvenIfTheCallFails", async () => {
    server.use(http.post(`${API}/v1/auth/logout`, () => HttpResponse.error()));
    const { setAccessToken } = await import("./session");
    setAccessToken("gs_x");

    await logout();

    expect(readAccessToken()).toBeNull();
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement** `types.ts`, `permissions.ts` (`const MINIMUM: Record<Action, Role>`; `const RANK: Record<Role, number> = { READONLY: 0, FINANCE: 1, OWNER: 2 }`; `can = RANK[role] >= RANK[MINIMUM[action]]`), `authApi.ts` (each `/v1/auth/*` call: `request(path, { method: "POST", body, credentials: "include" })`; session calls set the token; `logout` wraps in try/finally → `clearSession()`), `useMe.ts`, `gatewayError.ts` messages. Run the two tests → PASS; `pnpm typecheck`, `pnpm lint`.

- [ ] **Step 3: Commit** — `feat(auth): the auth api, useMe and the permissions table`.

---

### Task 3: `RequireSession`, the header (environment switch, user menu, verify banner), router

**Files:**
- Create: `src/auth/RequireSession.tsx`, `src/auth/RequireSession.test.tsx`, `src/app/EnvironmentSwitch.tsx`, `src/app/EnvironmentSwitch.test.tsx`, `src/app/UserMenu.tsx`, `src/app/VerifyBanner.tsx`
- Modify: `src/app/AppLayout.tsx`, `src/app/AppLayout.test.tsx`, `src/app/router.tsx`, `src/auth/useMerchant.ts` (keep; it still reads `/v1/merchant` for the name/env badge — or replace its callers with `useMe` and delete it: **delete it**, `AppLayout` uses `useMe().data.merchant.name`), `src/support/http.ts` (drop `apiKey`), `src/settings/AccountSection.tsx` (temporarily reads `useMe`; rewritten in Task 5)
- Delete: `src/auth/RequireApiKey.tsx` + test, `src/auth/apiKey.ts` + test, `src/auth/merchantApi.ts`, `src/auth/useMerchant.ts`, `src/auth/LoginPage.tsx` + test (Task 4 creates the new one at `/login`)
- Tests to update: every test that called `storeApiKey(...)` now calls `setAccessToken("gs_test")` and mocks `GET /v1/me` where the layout is rendered (`AppLayout.test`, `SettingsPage.test`, workspace tests that render the layout) — a shared `src/test/me.ts` fixture `aMe({ role, emailVerified })` and a `mockMe(server, me)` helper keep this to one line per test.

**Interfaces:**
- `RequireSession`: on mount, if no access token → `await refreshSession()`; while pending render nothing (a `<p>Carregando…</p>` is fine); on failure `Navigate` to `/login?next=<path>`; also subscribes to `onUnauthenticated` → `queryClient.clear()` + navigate. Renders `<Outlet />` when a token exists.
- `EnvironmentSwitch({ me })`: two-option segmented control `TEST | LIVE` (buttons with `aria-pressed`); LIVE `disabled` + `title="Confirme seu e-mail para usar produção"` when `!me.onboarding.email_verified`; on change `storeEnvironment`, `queryClient.clear()`, and a `useState` bump so the header re-reads. Exposes `useEnvironment()` hook (reads storage + listens to a tiny event emitter in `environment.ts`: add `onEnvironmentChange(listener)`).
- `VerifyBanner({ me })`: shown when `!me.user.email_verified`: "Confirme seu e-mail para ativar produção." + "Reenviar e-mail" (calls `resendVerification`, shows "Enviado" / the gateway error).
- `UserMenu({ me })`: name + role label (Dono / Financeiro / Leitura), "Minha conta" (link `/app/settings?tab=account`) and "Sair" (`logout()` → `queryClient.clear()` → navigate `/login`).
- Header: brand = `me.merchant.name`; nav unchanged; right side = `EnvironmentSwitch`, `ThemeToggle`, `UserMenu`. Header gets the amber top border (`border-t-2 border-warn-fg`) when TEST — the "you are in test" cue the spec asks for.
- Router: `/login`, `/signup`, `/forgot`, `/reset/:token`, `/verify/:token`, `/invite/:token` as top-level routes (pages from Task 4; until then they can be placeholders **only inside this task's working tree** — Task 4 lands them; to keep this task green, register only the routes whose pages exist: add the auth routes in Task 4). `/app/login` → `Navigate` to `/login`. `/app` element = `RequireSession`.

- [ ] **Step 1: Failing tests** — `RequireSession.test.tsx` (no token + refresh 200 → renders outlet and stores token; no token + refresh 401 → lands on `/login?next=/app/orders`; storage holds no `gs_`); `EnvironmentSwitch.test.tsx` (unverified: LIVE button disabled with the title; verified: clicking LIVE stores `LIVE`, clears the query cache — spy `queryClient.clear` — and re-renders pressed); `AppLayout.test.tsx` rewritten: mocks `/v1/me`, asserts brand = merchant name, the four nav links, the switch, the user menu with the role label, the banner when unverified and its absence when verified, "Sair" calls logout and lands on `/login`.
- [ ] **Step 2: Implement** as described; delete the key files; fix every test that used `storeApiKey` (one-line swap + `mockMe`). `pnpm test` fully green, `typecheck`, `lint`.
- [ ] **Step 3: Commit** — `feat(app): the panel bootstraps a session, switches environment and shows who is in` (one commit; the deletions ride with it).

---

### Task 4: The auth pages

**Files:**
- Create: `src/auth/LoginPage.tsx`, `src/auth/SignupPage.tsx`, `src/auth/ForgotPage.tsx`, `src/auth/ResetPage.tsx`, `src/auth/VerifyPage.tsx`, `src/auth/InvitePage.tsx`, `src/auth/AuthShell.tsx` (the centered card with brand + theme toggle shared by all six), `src/auth/PasswordField.tsx` (show/hide + strength bar: < 10 red "curta", 10–13 amber, ≥ 14 green), `src/auth/safeNext.ts` (+ test)
- Tests: `LoginPage.test.tsx`, `SignupPage.test.tsx`, `ForgotPage.test.tsx`, `ResetPage.test.tsx`, `VerifyPage.test.tsx`, `InvitePage.test.tsx`, `passwordsNeverPersist.test.tsx`
- Modify: `src/app/router.tsx` (register the six routes)

**Behaviour (pt-BR copy):**
- Login: e-mail, senha, "Entrar"; links "Criar conta" → `/signup`, "Esqueci a senha" → `/forgot`; on success `navigate(safeNext(next))` (default `/app/orders`); 401 → "E-mail ou senha incorretos."; 503/429 → the gateway message; `?next=` honoured (same-origin only, as today's `safeNext`).
- Signup: nome da loja, seu nome, e-mail, senha (PasswordField), "Criar conta"; 409 → error on the e-mail field; 422 WEAK_PASSWORD → on the password field; success → `/app/orders` (the banner will ask for verification).
- Forgot: e-mail, "Enviar link"; always shows "Se este e-mail tiver conta, enviamos um link. Vale por 1 hora." after 202 (and on any 4xx, to reveal nothing).
- Reset: new password + confirm (client check "As senhas não conferem"); 204 → "Senha redefinida" + link to `/login`; 410 → "Este link não vale mais" + link to `/forgot`.
- Verify: calls `verifyEmail(token)` on mount; 204 → "E-mail confirmado" + "Ir para o painel"; 410 → message + "Reenviar" hint (login first).
- Invite: name + password; "Aceitar convite"; 201 → `/app/orders`; 410 → "Convite expirado — peça um novo ao dono da loja"; 409 → "Este e-mail já tem conta: entre com ela".
- All forms: `noValidate`, errors via `TextField`'s `error` prop, submit disabled while pending, **password state reset to "" in `finally`**.

- [ ] **Step 1: Failing tests** per page (happy path with MSW, the named error paths, `next` on login), plus:
```tsx
// src/auth/passwordsNeverPersist.test.tsx — model: checkout/cardDataNeverPersists.test.tsx
it("noPasswordSurvivesTheRequestOrReachesStorageOrTheUrl", async () => {
  server.use(http.post(`${API}/v1/auth/login`, () => HttpResponse.json({ access_token: "gs_x", expires_in: 900 })));
  const { queryClient, router } = renderWithProviders(routes, { initialEntries: ["/login"] });
  await userEvent.type(screen.getByLabelText("E-mail"), "ana@loja.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senha-unica-xyz");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await screen.findByTestId("where");

  expect(JSON.stringify(window.localStorage)).not.toContain("senha-unica-xyz");
  expect(JSON.stringify(window.sessionStorage)).not.toContain("senha-unica-xyz");
  expect(JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data))).not.toContain("senha-unica-xyz");
  expect(router.state.location.search).not.toContain("senha");
});
```
- [ ] **Step 2: Implement** the pages on `AuthShell`; register routes. `pnpm test`, `typecheck`, `lint` green.
- [ ] **Step 3: Commit** — `feat(auth): login, signup, forgot, reset, verify and invite pages`.

---

### Task 5: Settings — Conta, Minha conta, Equipe

**Files:**
- Modify: `src/settings/SettingsPage.tsx` (tabs by role: Conta, Minha conta, Parcelamento [owner], Equipe [owner]; `?tab=` in the URL so the user menu can deep-link), `src/settings/SettingsPage.test.tsx`
- Rewrite: `src/settings/AccountSection.tsx` → `src/settings/account/StoreSection.tsx` (store name, environment explanation, verification state + resend)
- Create: `src/settings/account/MyAccountSection.tsx` (rename form; change-password form with current/new/confirm; sessions table with "atual" badge + "Encerrar as outras sessões" confirm), `src/settings/account/MyAccountSection.test.tsx`, `src/settings/team/TeamSection.tsx` (members table: nome, e-mail, papel [select for others, disabled for self], último acesso, "Remover" confirm; pending invites with expiry; invite form e-mail + papel), `src/settings/team/TeamSection.test.tsx`, `src/settings/team/roleLabels.ts` (`OWNER→"Dono"`, `FINANCE→"Financeiro"`, `READONLY→"Leitura"`) + test
- Delete: the old `AccountSection.tsx` (the key prefix no longer exists)

**Behaviour:** password change 401 → error on "Senha atual"; success → "Senha alterada; as outras sessões foram encerradas." Team: `LAST_OWNER`/`OWN_ACCOUNT`/`EMAIL_TAKEN`/`EMAIL_NOT_VERIFIED` rendered via `messageFor`; invite success → "Convite enviado" and the pending list refreshes; role change via `PATCH`, remove via `DELETE` with confirm naming the person. Tabs a role cannot use do not render (FINANCE sees Conta + Minha conta only; READONLY the same).

- [ ] **Step 1: Failing tests** (tabs per role; rename; password change happy + wrong current; sessions list + revoke others; team list; invite sends `{email, role}`; role change; remove with confirm; own-account select disabled).
- [ ] **Step 2: Implement.** `pnpm test`, `typecheck`, `lint` green.
- [ ] **Step 3: Commit** — `feat(settings): store, my account and team tabs by role`.

---

### Task 6: Role-gate the existing actions, README

**Files:**
- Modify: `src/order/OrdersList.tsx` ("Nova cobrança" + `NewOrderForm` mount → `create_charge`), `src/order/OrderActions.tsx` (cancel → `cancel`, refund → `refund`, capture if present → `capture`), `src/customer/CustomersPage.tsx` ("Novo cliente" → `create_customer`), `src/plan/PlansPage.tsx` ("Novo plano" → `create_plan`; "Editar" → `edit_plan`), `src/settings/SettingsPage.tsx` (already by role in Task 5), their tests, `README.md`
- Create: `src/auth/useCan.ts` (`useCan(action)` = `can(useMe().data?.user.role ?? "READONLY", action)`; while `me` loads, nothing renders — safer than flashing a button)

- [ ] **Step 1: Failing tests** — one per screen rendering with `mockMe({ role: "READONLY" })` asserting the button is absent and with `FINANCE` asserting it is present; `OrderActions` with READONLY shows neither Cancelar nor Reembolsar.
- [ ] **Step 2: Implement** with `useCan`. README: the "Telas" table (new routes), the "Segurança" section rewritten (token in memory, cookie, environment header, roles), the "Rodar contra um gateway local" steps (signup instead of `dev_merchant.py`; `GATEWAY_CORS_ORIGINS` must list the panel origin — credentials require an exact origin; mail: with `GATEWAY_MAIL_HOST` empty the verify link is in the gateway log).
- [ ] **Step 3: Commit** — `feat(panel): actions follow the role; readme for the password login`. `pnpm build` green.

---

## Self-review notes

- Spec coverage: §1 (Tasks 1–4), §2 environment switch (Task 3; dashboard is F6), §8 Conta/Minha conta/Equipe (Task 5), roles table (Tasks 2, 6), API key leaves the browser (Tasks 1, 3). Chaves/Provedores tabs are F5.
- Interfaces: `setAccessToken/readAccessToken/clearSession`, `readEnvironment/storeEnvironment/onEnvironmentChange`, `refreshSession`, `meKeys`, `can(role, action)`, `useMe`, `useCan` are named identically across tasks.
- Review Focus 1–5 → Tasks 1, 1+3, 3, 6, 4.
- Known rulings for the executor: Task 1 leaves `apiKey.ts` alive until Task 3 deletes its callers; Task 3 registers no auth routes (Task 4 does) so the tree stays green between tasks; `useMerchant`/`merchantApi` are deleted in Task 3 (the header reads `/v1/me`).
