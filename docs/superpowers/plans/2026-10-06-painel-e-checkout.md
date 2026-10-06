# Merchant Panel and Payer Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single Vite/React bundle with a merchant panel (`/app/*`, API key in `sessionStorage`) and a payer checkout (`/pay/:token`, no key) against the `payment-gateway` API.

**Architecture:** Two route trees in one app. `support/` holds the HTTP client, money and error helpers; each concept folder (`auth`, `order`, `customer`, `checkout`) holds its screens, queries and tests. The checkout's state machine is a pure module tested without DOM; card data lives only in form state and is zeroed after the response.

**Tech Stack:** Node 22, pnpm, Vite 6, React 19, TypeScript strict, React Router 7, TanStack Query 5, Tailwind 4, Vitest + Testing Library + MSW 2, ESLint + Prettier, `qrcode` (QR rendering), Playwright (optional smoke). Deploy on Vercel.

**Spec:** `docs/superpowers/specs/2026-10-06-painel-e-checkout-design.md`

## Global Constraints

- Identifiers, comments and commit subjects in English; screen copy in Portuguese (pt-BR). Comments explain why, never what. No `any`. One component per file; a file over ~200 lines is split.
- Folders are concepts (`auth/`, `order/`, `customer/`, `checkout/`), never roles; `support/` only for what every concept uses.
- Red-first: a failing test precedes every behaviour. `pnpm test` (Vitest), `pnpm typecheck` (`tsc --noEmit`), `pnpm lint`, `pnpm build` all green before each commit.
- The API key lives only in `sessionStorage["gateway.apiKey"]`; it is never put in a URL, a log, a React Query key, or a request to `/v1/checkout/**`. A 401 clears it and redirects to `/app/login?next=<path>`.
- Card number, expiry and CVV never enter `localStorage`, `sessionStorage`, the TanStack Query cache, the checkout state machine, the URL, or any `console.*`. They live in form state and are reset after the response.
- Money: the API uses integer cents; the UI shows `R$ 1.234,56` (`Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`); the form parses pt-BR input into cents without floating point.
- API base from `import.meta.env.VITE_API_URL` (dev `http://localhost:8080`). Merchant key header: `Authorization: Bearer <key>`. Every merchant POST that creates or changes a resource sends `Idempotency-Key`.
- API contract (from the gateway, branch `feat/public-checkout` + `feat/order-and-customer-listing`), snake_case JSON:
  - `GET /v1/merchant` → `{merchant_id, name, environment}` (`TEST|LIVE`).
  - `GET /v1/orders?status=&limit=&cursor=` → `OrderResponse[]`, newest first; next page = `cursor=<id of last item>`; `GET /v1/orders/{id}`; `GET /v1/orders/{id}/payments` → `PaymentResponse[]`.
  - `OrderResponse`: `{id, status: OPEN|PAID|CANCELED|EXPIRED, amount, currency, reference, description, customer_id, paid_payment_id, paid_at, expires_at, subscription_id, invoice_number, period, payments: [{id, method, status, created_at}], created_at, checkout_url}` (`checkout_url` only on create and rotate, null on GET).
  - `POST /v1/orders` body `{amount, currency:"BRL", reference?, description?, customer_id? | customer?: {name, document, email?, address?}, expires_at?}` → 201 `OrderResponse` with `checkout_url`. `POST /v1/orders/{id}/cancel` → 200. `POST /v1/orders/{id}/checkout-token/rotate` → 200 with new `checkout_url`.
  - `PaymentResponse`: `{id, status: CREATED|PENDING|AUTHORIZED|COMPLETED|FAILED|EXPIRED|CANCELED, method: PIX|BOLECODE|CARD, provider, environment, amount, currency, reference, order_id, description, pix: {txid, copia_e_cola, location, end_to_end_id}|null, boleto: {linha_digitavel, codigo_barras, due_date, payment_limit_date, paid_via}|null, card: {brand, last4, installments, authorization_code, tid, captured_amount, card_id}|null, expires_at, paid_at, paid_amount, refunded_amount, created_at}`.
  - `POST /v1/payments/{id}/refunds` body `{amount?}` → 201/202 refund object (read the response status from MSW fixtures; UI only needs success).
  - `GET /v1/customers?limit=&cursor=` → `CustomerResponse[]`; `GET /v1/customers?document=` → 0 or 1; `POST /v1/customers` body `{name, document, email?, address?: {street, district, city, state, zip}}` → 201 `{id, name, document (masked), email, address, created_at, updated_at}`; 409 `CUSTOMER_EXISTS` with `customer_id`.
  - Public: `GET /v1/checkout/{token}` → `{order_id, merchant_name, amount, currency, description, status, expires_at, methods: ("PIX"|"BOLECODE"|"CARD")[], active_payment: CheckoutPayment|null}`; `POST /v1/checkout/{token}/payments` body `{method:"PIX", expires_in?}` | `{method:"BOLECODE", due_date?, payment_limit_days?}` | `{method:"CARD", card:{number, holder, expiry:"MM/YY", cvv, brand?}, installments?}` → 201 `CheckoutPayment`; `GET /v1/checkout/{token}/payments/{id}`; `POST /v1/checkout/{token}/payments/{id}/cancel`.
  - `CheckoutPayment`: `{id, method, status, pix: {copia_e_cola, expires_at}|null, boleto: {linha_digitavel, due_date, payment_limit_date}|null, card: {brand, last4, installments}|null, paid_at, created_at}`.
  - Errors are RFC 9457 problem bodies `{type: "urn:gateway:<CODE>", title, status, detail, instance, ...extras}`; code = the part after `urn:gateway:`. Known: `UNAUTHENTICATED` 401, `NOT_FOUND` 404, `CHECKOUT_ORDER_CLOSED` 410, `ORDER_HAS_ACTIVE_PAYMENT` 409 (+`payment_id`), `ORDER_CLOSED` 409, `ALREADY_PAID` 409, `CARD_DECLINED` 402 (+`decline_code`, `payment_id`), `CHECKOUT_CANNOT_CANCEL_CARD` 422, `PROVIDER_CREDENTIALS_MISSING` 422, `CUSTOMER_EXISTS` 409, `CUSTOMER_INVALID` 422, `INVALID_REQUEST` 400, `IDEMPOTENCY_KEY_REQUIRED` 400, `RATE_LIMITED` 429 (+`Retry-After`), `METHOD_NOT_ALLOWED`, `UNSUPPORTED_MEDIA_TYPE`.

## Review Focus

1. A pasted API key with surrounding whitespace or a trailing newline must still log in (trim before validating). Pinned in Task 2 (`login.test.tsx: aKeyPastedWithWhitespaceStillLogsIn`).
2. An amount typed as `1.234,56`, `1234,56`, `1234.56` or `R$ 12` must all parse to the same cents, and `0`/empty must be refused before the request. Pinned in Task 1 (`money.test.ts`).
3. Reloading `/pay/:token` mid-Pix must resume the existing attempt (`active_payment` of the same method), not offer a second one. Pinned in Task 6 (`checkoutState.test.ts: anActivePixOnLoadResumesPolling`).
4. The browser back button after "pago" must not re-open the method chooser (state is derived from the API on every load). Pinned in Task 7 (`PayPage.test.tsx: aPaidOrderShowsPaidOnEveryLoad`).
5. A 429 from the public routes must show "muitas tentativas, aguarde" with the `Retry-After` seconds and must not loop the polling. Pinned in Task 7 (`PixStep.test.tsx: aRateLimitPausesPollingForRetryAfter`).

---

### Task 1: Scaffold, tooling, CI and the `support/` helpers

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `.env.example`, `vercel.json`, `.github/workflows/ci.yml`, `README.md`
- Create: `src/main.tsx`, `src/app/App.tsx`, `src/app/router.tsx`, `src/index.css`
- Create: `src/support/money.ts`, `src/support/money.test.ts`, `src/support/gatewayError.ts`, `src/support/gatewayError.test.ts`, `src/support/http.ts`, `src/support/http.test.ts`, `src/support/dates.ts`
- Create: `src/test/setup.ts`, `src/test/msw/server.ts`, `src/test/msw/handlers.ts`

**Interfaces:**
- Produces:
  - `formatBrl(cents: number): string` → `"R$ 1.234,56"`; `parseBrl(input: string): number | null` → cents or `null` for empty/invalid/zero/negative.
  - `type GatewayError = { status: number; code: string; detail: string; field?: string; extras: Record<string, unknown>; retryAfterSeconds?: number }`; `class GatewayRequestError extends Error { readonly error: GatewayError }`; `class NetworkError extends Error {}`; `messageFor(error: unknown): string` (pt-BR table by code, fallback to `detail`, network → "não foi possível falar com o servidor").
  - `http.ts`: `request<T>(path: string, init?: { method?, body?: unknown, headers?: Record<string,string>, apiKey?: string, idempotencyKey?: string }): Promise<{ data: T; headers: Headers }>` — base `VITE_API_URL`, JSON in/out, throws `GatewayRequestError` on non-2xx with a parsed problem body (reads `Retry-After` into `retryAfterSeconds`), `NetworkError` on fetch failure. Never logs. `apiKey` adds `Authorization: Bearer`; `idempotencyKey` adds the header.
  - `dates.ts`: `formatDateTime(iso: string): string` (pt-BR, São Paulo), `formatDate(isoDate: string): string`.
  - Scripts: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm test:watch`, `pnpm typecheck`, `pnpm lint`, `pnpm format`.
  - MSW: `server` (node) started in `src/test/setup.ts` with `onUnhandledRequest: "error"`; `handlers.ts` exports an empty array to be extended per test file.

- [ ] **Step 1: Scaffold**

```bash
cd C:/Dev/payment-gateway-web
pnpm create vite@latest . --template react-ts   # answer "ignore files and continue" if it asks about the non-empty dir
pnpm add react-router@7 @tanstack/react-query@5 qrcode
pnpm add -D tailwindcss@4 @tailwindcss/vite vitest@3 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom msw@2 @types/qrcode prettier eslint-config-prettier
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["src/test/setup.ts"],
    css: false,
  },
});
```

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterAll(() => server.close());
```

`src/test/msw/server.ts`: `export const server = setupServer(...handlers);` with `import { setupServer } from "msw/node"`.

`package.json` scripts: `"dev": "vite"`, `"build": "tsc -b && vite build"`, `"test": "vitest run"`, `"test:watch": "vitest"`, `"typecheck": "tsc -b --noEmit"`, `"lint": "eslint ."`, `"format": "prettier --write ."`. `engines.node >=22`. `.env.example`: `VITE_API_URL=http://localhost:8080`.

`tsconfig.app.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"types": ["vite/client", "vitest/globals"]` removed (globals false) → `["vite/client"]`.

`vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; connect-src 'self' https://api.REPLACE-ME; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

(README explains `REPLACE-ME` is the API host per environment; `Referrer-Policy: no-referrer` exists because the checkout token is in the URL.)

`.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
        env: { VITE_API_URL: http://localhost:8080 }
```

- [ ] **Step 2: Failing tests for money, errors and http**

`src/support/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatBrl, parseBrl } from "./money";

describe("formatBrl", () => {
  it("formats cents as pt-BR currency", () => {
    expect(formatBrl(123456)).toBe("R$\u00a01.234,56");
    expect(formatBrl(5)).toBe("R$\u00a00,05");
  });
});

describe("parseBrl", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["R$ 12", 1200],
    ["12", 1200],
    ["0,10", 10],
  ])("parses %s to %i cents", (input, cents) => {
    expect(parseBrl(input)).toBe(cents);
  });

  it.each(["", "   ", "0", "0,00", "-5", "abc", "1,2,3"])("refuses %s", (input) => {
    expect(parseBrl(input)).toBeNull();
  });

  it("never goes through floating point", () => {
    expect(parseBrl("0,29")).toBe(29); // 0.29 * 100 === 28.999999999999996 in JS
  });
});
```

`src/support/gatewayError.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GatewayRequestError, NetworkError, messageFor, problemToError } from "./gatewayError";

describe("problemToError", () => {
  it("reads the code from the urn and keeps extras", () => {
    const error = problemToError(409, {
      type: "urn:gateway:ORDER_HAS_ACTIVE_PAYMENT",
      title: "Conflict",
      status: 409,
      detail: "order x has an active payment",
      payment_id: "01ABC",
    }, new Headers());
    expect(error.code).toBe("ORDER_HAS_ACTIVE_PAYMENT");
    expect(error.extras.payment_id).toBe("01ABC");
  });

  it("reads Retry-After on a 429", () => {
    const error = problemToError(429, { type: "urn:gateway:RATE_LIMITED", status: 429, detail: "x" }, new Headers({ "Retry-After": "7" }));
    expect(error.retryAfterSeconds).toBe(7);
  });

  it("falls back to UNKNOWN when the body is not a problem", () => {
    expect(problemToError(502, "<html>", new Headers()).code).toBe("UNKNOWN");
  });
});

describe("messageFor", () => {
  it("translates known codes to Portuguese", () => {
    const error = new GatewayRequestError({ status: 410, code: "CHECKOUT_ORDER_CLOSED", detail: "x", extras: {} });
    expect(messageFor(error)).toBe("Este link de pagamento não está mais disponível.");
  });
  it("uses the detail for unknown codes", () => {
    const error = new GatewayRequestError({ status: 422, code: "SOMETHING_NEW", detail: "the thing is wrong", extras: {} });
    expect(messageFor(error)).toBe("the thing is wrong");
  });
  it("names the network for a NetworkError", () => {
    expect(messageFor(new NetworkError())).toBe("Não foi possível falar com o servidor. Tente de novo.");
  });
});
```

`src/support/http.test.ts` (MSW):

```ts
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { GatewayRequestError } from "./gatewayError";
import { request } from "./http";

describe("request", () => {
  it("sends the bearer key and the idempotency key and parses json", async () => {
    let seen: Headers | undefined;
    server.use(http.post("http://localhost:8080/v1/orders", async ({ request: req }) => {
      seen = req.headers;
      return HttpResponse.json({ id: "01X" }, { status: 201 });
    }));
    const { data } = await request<{ id: string }>("/v1/orders", { method: "POST", body: { amount: 1 }, apiKey: "gk_test_x", idempotencyKey: "k1" });
    expect(data.id).toBe("01X");
    expect(seen?.get("authorization")).toBe("Bearer gk_test_x");
    expect(seen?.get("idempotency-key")).toBe("k1");
  });

  it("throws a GatewayRequestError with the parsed problem on 4xx", async () => {
    server.use(http.get("http://localhost:8080/v1/orders/nope", () =>
      HttpResponse.json({ type: "urn:gateway:NOT_FOUND", status: 404, detail: "order not found: nope" }, { status: 404 })));
    await expect(request("/v1/orders/nope", { apiKey: "k" })).rejects.toMatchObject({ error: { code: "NOT_FOUND", status: 404 } });
  });

  it("never sends the key when none is given", async () => {
    let seen: Headers | undefined;
    server.use(http.get("http://localhost:8080/v1/checkout/chk_x", ({ request: req }) => { seen = req.headers; return HttpResponse.json({}); }));
    await request("/v1/checkout/chk_x");
    expect(seen?.has("authorization")).toBe(false);
  });
});
```

(`import.meta.env.VITE_API_URL` in tests: set `VITE_API_URL=http://localhost:8080` via `vitest.config.ts` `test.env` or a `.env.test` file.)

- [ ] **Step 3: Run tests, expect compile/import failures**

Run: `pnpm test`

- [ ] **Step 4: Implement `support/`**

`money.ts`:

```ts
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBrl(cents: number): string {
  return BRL.format(cents / 100);
}

/**
 * Cents from what a Brazilian types. Done on strings, not numbers: 0.29 * 100 is 28.999… in
 * floating point, and a charge that is one cent short is a dispute.
 */
export function parseBrl(input: string): number | null {
  const cleaned = input.replace(/R\$/g, "").replace(/\s/g, "");
  if (cleaned === "" || /[^0-9.,]/.test(cleaned)) return null;

  const commas = (cleaned.match(/,/g) ?? []).length;
  const dots = (cleaned.match(/\./g) ?? []).length;
  if (commas > 1 || (commas === 0 && dots > 1 && !/^\d{1,3}(\.\d{3})+$/.test(cleaned))) return null;

  let integer: string;
  let fraction: string;
  if (commas === 1) {
    const [left, right] = cleaned.split(",") as [string, string];
    integer = left.replace(/\./g, "");
    fraction = right;
  } else if (dots === 1 && !/^\d{1,3}\.\d{3}$/.test(cleaned)) {
    const [left, right] = cleaned.split(".") as [string, string];
    integer = left;
    fraction = right;
  } else {
    integer = cleaned.replace(/\./g, "");
    fraction = "";
  }

  if (!/^\d*$/.test(integer) || !/^\d{0,2}$/.test(fraction)) return null;
  const cents = Number(integer || "0") * 100 + Number((fraction + "00").slice(0, 2));
  return cents > 0 ? cents : null;
}
```

(Write it to make the table pass; the `1.234` ambiguity is resolved as thousands, documented in a comment.)

`gatewayError.ts`:

```ts
export type GatewayError = {
  status: number;
  code: string;
  detail: string;
  field?: string;
  extras: Record<string, unknown>;
  retryAfterSeconds?: number;
};

export class GatewayRequestError extends Error {
  constructor(readonly error: GatewayError) {
    super(error.detail);
  }
}

export class NetworkError extends Error {
  constructor() {
    super("network");
  }
}

const KNOWN = ["type", "title", "status", "detail", "instance"];

export function problemToError(status: number, body: unknown, headers: Headers): GatewayError {
  const retry = headers.get("Retry-After");
  const retryAfterSeconds = retry && /^\d+$/.test(retry) ? Number(retry) : undefined;
  if (typeof body !== "object" || body === null) {
    return { status, code: "UNKNOWN", detail: "", extras: {}, retryAfterSeconds };
  }
  const problem = body as Record<string, unknown>;
  const type = typeof problem.type === "string" ? problem.type : "";
  const code = type.startsWith("urn:gateway:") ? type.slice("urn:gateway:".length) : "UNKNOWN";
  const extras = Object.fromEntries(Object.entries(problem).filter(([key]) => !KNOWN.includes(key)));
  return {
    status,
    code,
    detail: typeof problem.detail === "string" ? problem.detail : "",
    field: typeof problem.field === "string" ? problem.field : undefined,
    extras,
    retryAfterSeconds,
  };
}

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Chave de API inválida.",
  NOT_FOUND: "Não encontrado.",
  CHECKOUT_ORDER_CLOSED: "Este link de pagamento não está mais disponível.",
  ORDER_HAS_ACTIVE_PAYMENT: "Já existe uma tentativa de pagamento em andamento.",
  ORDER_CLOSED: "Esta cobrança já foi encerrada.",
  ALREADY_PAID: "Esta cobrança já foi paga.",
  CARD_DECLINED: "Cartão recusado. Tente outro cartão ou outro método.",
  CHECKOUT_CANNOT_CANCEL_CARD: "Um pagamento com cartão não pode ser cancelado por aqui.",
  PROVIDER_CREDENTIALS_MISSING: "Este método não está disponível para esta loja.",
  CUSTOMER_EXISTS: "Já existe um cliente com este documento.",
  CUSTOMER_INVALID: "Dados do cliente inválidos.",
  INVALID_REQUEST: "Requisição inválida.",
  RATE_LIMITED: "Muitas tentativas. Aguarde um instante.",
};

export function messageFor(error: unknown): string {
  if (error instanceof NetworkError) return "Não foi possível falar com o servidor. Tente de novo.";
  if (error instanceof GatewayRequestError) {
    return MESSAGES[error.error.code] ?? (error.error.detail || "Algo deu errado.");
  }
  return "Algo deu errado.";
}
```

`http.ts`:

```ts
import { GatewayRequestError, NetworkError, problemToError } from "./gatewayError";

const BASE = import.meta.env.VITE_API_URL as string;

type Init = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  apiKey?: string;
  idempotencyKey?: string;
};

export async function request<T>(path: string, init: Init = {}): Promise<{ data: T; headers: Headers }> {
  const headers: Record<string, string> = { Accept: "application/json", ...init.headers };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.apiKey) headers.Authorization = `Bearer ${init.apiKey}`;
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new NetworkError();
  }

  const text = await response.text();
  const parsed: unknown = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new GatewayRequestError(problemToError(response.status, parsed, response.headers));
  }
  return { data: parsed as T, headers: response.headers };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
```

`dates.ts`: `formatDateTime` with `Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })`; `formatDate` for `YYYY-MM-DD` → `dd/mm/yyyy`.

`src/app/App.tsx`: `QueryClientProvider` + `RouterProvider`. `router.tsx`: `createBrowserRouter` with `/` → redirect to `/app/orders`, `/app/*` placeholder `<div>painel</div>`, `/pay/:token` placeholder `<div>pagar</div>` (Tasks 2–7 replace them). `index.css`: `@import "tailwindcss";`.

- [ ] **Step 5: Green, then commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

```bash
git add -A
git commit -m "chore: scaffold vite react app with support helpers, msw and ci" -m "Money parsing works on strings because 0.29*100 is 28.999… in floating point. Errors are RFC 9457 problems with the code in the urn." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Auth — key storage, login, route guard, 401 handling

**Files:**
- Create: `src/auth/apiKey.ts`, `src/auth/apiKey.test.ts`, `src/auth/useMerchant.ts`, `src/auth/LoginPage.tsx`, `src/auth/LoginPage.test.tsx`, `src/auth/RequireApiKey.tsx`, `src/auth/RequireApiKey.test.tsx`, `src/auth/merchantApi.ts`
- Modify: `src/app/router.tsx`, `src/support/http.ts` (no change in signature; the merchant client wraps it)
- Create: `src/support/merchantRequest.ts`

**Interfaces:**
- Produces:
  - `apiKey.ts`: `readApiKey(): string | null`, `storeApiKey(key: string): void` (trims), `clearApiKey(): void`, `KEY = "gateway.apiKey"`. All wrapped in try/catch (private mode).
  - `merchantRequest.ts`: `merchantRequest<T>(path, init?)` = `request` with `apiKey: readApiKey()`; on 401 it calls `clearApiKey()` and throws `new Unauthenticated()` (class exported) — the guard listens via a module-level `onUnauthenticated(cb)` subscription used by `RequireApiKey` to navigate to `/app/login?next=`.
  - `merchantApi.ts`: `getMerchant(apiKey?: string): Promise<Merchant>` with `type Merchant = { merchant_id: string; name: string; environment: "TEST" | "LIVE" }`.
  - `useMerchant()`: TanStack query `["merchant"]` (never includes the key).
  - `LoginPage`: textarea-free single `input type="password"` named "chave", button "Entrar"; validates with `getMerchant(trimmedKey)`; on success `storeApiKey` and navigate to `next ?? "/app/orders"`; on failure shows "Chave de API inválida." without detail.
  - `RequireApiKey`: renders `<Outlet/>` when a key exists, else `<Navigate to="/app/login?next=…"/>`.
  - Layout `src/app/AppLayout.tsx`: header with merchant name and environment badge (`TEST` amber, `LIVE` green), nav links "Cobranças" and "Clientes", "Sair" button (clears key, goes to login).

- [ ] **Step 1: Failing tests**

`apiKey.test.ts`: stores trimmed, reads back, clears; survives a throwing `sessionStorage` (mock `Storage.prototype.setItem` to throw → `storeApiKey` does not throw, `readApiKey` returns null).

`LoginPage.test.tsx` (render with `MemoryRouter` + `QueryClientProvider`, MSW `GET /v1/merchant`):
- `aKeyPastedWithWhitespaceStillLogsIn`: type `"  gk_test_abc\n"`, click Entrar → request had `Authorization: Bearer gk_test_abc`, `sessionStorage` holds `gk_test_abc`, location is `/app/orders`.
- `anInvalidKeyShowsAFixedMessage`: MSW 401 problem → text "Chave de API inválida." visible, nothing stored.
- `nextIsHonoured`: route `/app/login?next=/app/orders/01X` → after login location is `/app/orders/01X`.

`RequireApiKey.test.tsx`: without key → redirected to `/app/login?next=%2Fapp%2Forders`; with key → child rendered; a `merchantRequest` that gets a 401 inside the child → key cleared and redirected.

- [ ] **Step 2: Run, expect failures** — `pnpm test`

- [ ] **Step 3: Implement** per Interfaces. `onUnauthenticated`: a tiny event emitter (`const listeners = new Set<() => void>()`); `RequireApiKey` subscribes in `useEffect` and calls `navigate("/app/login?next=" + encodeURIComponent(location.pathname))`.

- [ ] **Step 4: Green; commit**

```bash
git add -A
git commit -m "feat(auth): login with the api key in sessionStorage and a route guard" -m "sessionStorage, not localStorage: the key dies with the tab until scoped keys exist. A 401 anywhere clears it and returns to login with next." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Orders — list and detail (read-only)

**Files:**
- Create: `src/order/orderApi.ts`, `src/order/types.ts`, `src/order/OrdersPage.tsx`, `src/order/OrdersPage.test.tsx`, `src/order/OrderDetailPage.tsx`, `src/order/OrderDetailPage.test.tsx`, `src/order/StatusBadge.tsx`, `src/order/AttemptsTable.tsx`
- Create: `src/test/fixtures/orders.ts` (builders `anOrder(overrides)`, `aPayment(overrides)`)
- Modify: `src/app/router.tsx`

**Interfaces:**
- Produces:
  - `types.ts`: `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `Order`, `Payment` exactly per the contract in Global Constraints (snake_case fields kept as-is; no renaming layer).
  - `orderApi.ts`: `listOrders(params: { status?: OrderStatus; cursor?: string; limit?: number }): Promise<Order[]>`, `getOrder(id): Promise<Order>`, `listAttempts(id): Promise<Payment[]>`, `orderKeys = { all: ["orders"], list: (p) => ["orders","list",p], detail: (id) => ["orders", id], attempts: (id) => ["orders", id, "attempts"] }`.
  - `OrdersPage`: filter `<select>` status (Todas/Abertas/Pagas/Canceladas/Expiradas), table columns Criado em, Cliente/Pagador, Descrição, Valor, Status, Método; "Carregar mais" button appends the next page using `cursor = last.id` (pages kept in component state keyed by cursor via `useInfiniteQuery`); `refetchInterval: 10_000` only when `document.visibilityState === "visible"`; link "Nova cobrança" to `/app/orders/new`; each row links to `/app/orders/:id`.
  - `OrderDetailPage`: summary (valor, status, descrição, referência, criado em, vence em), `AttemptsTable` (método, status, valor, criado em, id), `refetchInterval: 5_000` while any attempt is `PENDING|AUTHORIZED|CREATED`; placeholders for the actions and the link panel (Task 5).
  - `StatusBadge({status})` for both order and payment statuses with pt-BR labels (`Aberta`, `Paga`, `Cancelada`, `Expirada`, `Pendente`, `Autorizado`, `Concluído`, `Falhou`, `Expirado`, `Cancelado`, `Criado`).

- [ ] **Step 1: Failing tests** (MSW handlers for `GET /v1/orders`, `/v1/orders/:id`, `/v1/orders/:id/payments`):
- `OrdersPage.test.tsx`: `rendersOrdersNewestFirstWithFormattedMoney` (two fixtures, expects `R$ 49,90` and status label); `loadMoreRequestsTheNextCursor` (first call returns 20 items, click "Carregar mais" → second call has `cursor=<id of 20th>`); `statusFilterIsSentToTheApi` (select "Pagas" → `status=PAID`).
- `OrderDetailPage.test.tsx`: `showsTheOrderAndItsAttempts`; `pollsWhileAnAttemptIsPending` (use `vi.useFakeTimers()`; after 5 s a second GET of attempts happened).

- [ ] **Step 2: Run, expect failures**
- [ ] **Step 3: Implement** per Interfaces (Tailwind tables; keep each component under 200 lines).
- [ ] **Step 4: Green; commit**

```bash
git add -A
git commit -m "feat(orders): list with cursor and status filter, detail with attempts" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: New order and customers

**Files:**
- Create: `src/customer/customerApi.ts`, `src/customer/types.ts`, `src/customer/CustomersPage.tsx`, `src/customer/CustomersPage.test.tsx`, `src/customer/NewCustomerPage.tsx`, `src/customer/NewCustomerPage.test.tsx`, `src/customer/CustomerPicker.tsx`, `src/customer/CustomerPicker.test.tsx`, `src/customer/document.ts`, `src/customer/document.test.ts`
- Create: `src/order/NewOrderPage.tsx`, `src/order/NewOrderPage.test.tsx`, `src/order/MoneyInput.tsx`, `src/order/MoneyInput.test.tsx`
- Modify: `src/order/orderApi.ts` (`createOrder`), `src/app/router.tsx`

**Interfaces:**
- Produces:
  - `document.ts`: `maskDocument(digitsOrMasked: string): string` → CPF `***.456.789-**`, CNPJ `**.345.678/0001-**` (the API already masks in responses; this is for inline display of what the user typed), `onlyDigits(s)`, `isCpfOrCnpjShape(s)` (11 or 14 digits).
  - `customerApi.ts`: `listCustomers({cursor?, limit?})`, `findByDocument(document)`, `createCustomer(body, idempotencyKey)`; `type Customer`, `type NewCustomer = { name; document; email?; address? }`.
  - `CustomerPicker({ value, onChange })`: mode "Existente" (search by document → `findByDocument`; shows name + masked doc; sets `customer_id`) or "Novo" (name, document, email; sets inline `customer`); exposes `type CustomerChoice = { customer_id: string } | { customer: NewCustomer }`.
  - `MoneyInput({ valueCents, onChange })`: text input with `inputMode="decimal"`, formats on blur, reports `number | null`.
  - `NewOrderPage`: fields valor, descrição, referência, vencimento (`<input type="datetime-local">` → ISO with São Paulo offset), `CustomerPicker`; `Idempotency-Key = crypto.randomUUID()` generated once per mounted form (`useRef`) and reused across retries; on success navigates to `/app/orders/:id` with `state: { checkoutUrl }` so the detail can show the link once (Task 5).
  - `createOrder(body, idempotencyKey): Promise<Order>`.
  - `CustomersPage` (table: nome, documento (as returned, masked), e-mail, criado em; "Carregar mais"); `NewCustomerPage` (nome, documento, e-mail, endereço opcional: rua, bairro, cidade, UF, CEP); 409 `CUSTOMER_EXISTS` shows "Já existe um cliente com este documento." with a link to that customer's id; validation errors with `field` go to the matching input (`customer.document` → documento).

- [ ] **Step 1: Failing tests**
- `MoneyInput.test.tsx`: typing `1234,5` and blurring shows `R$ 1.234,50` and reports 123450; typing `abc` reports null and shows "Valor inválido".
- `NewOrderPage.test.tsx`: `sendsCentsAndAStableIdempotencyKeyOnDoubleClick` (MSW records both POSTs' `Idempotency-Key`; they are equal; body `amount: 4990`, `currency: "BRL"`, `customer: {name, document}`); `refusesAnEmptyAmountBeforeTheRequest` (no request made); `navigatesToTheDetailWithTheCheckoutUrl`.
- `CustomerPicker.test.tsx`: searching a document calls `GET /v1/customers?document=…` and selecting sets `customer_id`.
- `NewCustomerPage.test.tsx`: `aDuplicateShowsTheExistingCustomer` (409 with `customer_id`), `aFieldErrorLandsOnItsInput` (422 `{field: "customer.document"}` → the documento input has `aria-invalid` and the message).
- `document.test.ts`: masks CPF and CNPJ.

- [ ] **Step 2: Run, expect failures**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Green; commit**

```bash
git add -A
git commit -m "feat(orders): new order form with customer picker and customers pages" -m "The Idempotency-Key is minted once per form so a double click or a retry never creates two orders." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Order actions — checkout link, rotate, cancel, refund

**Files:**
- Create: `src/order/CheckoutLinkPanel.tsx`, `src/order/CheckoutLinkPanel.test.tsx`, `src/order/OrderActions.tsx`, `src/order/OrderActions.test.tsx`, `src/order/RefundDialog.tsx`, `src/support/ConfirmDialog.tsx`, `src/support/copyToClipboard.ts`
- Modify: `src/order/orderApi.ts` (`cancelOrder`, `rotateCheckoutToken`, `refundPayment`), `src/order/OrderDetailPage.tsx`

**Interfaces:**
- Produces:
  - `CheckoutLinkPanel({ order, initialUrl })`: shows `initialUrl` (from navigation state after create) with "Copiar"; when none, shows "O link só é exibido uma vez. Gere um novo para enviar ao pagador." and the button "Gerar novo link" → `POST /v1/orders/{id}/checkout-token/rotate` (idempotency key per click) → shows the new url. Hidden when order is not `OPEN`.
  - `OrderActions({ order, attempts })`: "Cancelar cobrança" (`OPEN` only; `ConfirmDialog`) → `POST /v1/orders/{id}/cancel`; "Reembolsar" on the `COMPLETED` attempt (`RefundDialog`: total or partial amount via `MoneyInput`, ≤ paid amount) → `POST /v1/payments/{paymentId}/refunds` `{amount?}`; both invalidate the detail and attempts queries; errors shown via `messageFor`.
  - `copyToClipboard(text): Promise<boolean>` with `navigator.clipboard` and a textarea fallback.

- [ ] **Step 1: Failing tests**
- `CheckoutLinkPanel.test.tsx`: shows initial url and copies it (mock `navigator.clipboard.writeText`); without initial url, rotate shows the new url from MSW; hidden for a `PAID` order.
- `OrderActions.test.tsx`: cancel asks for confirmation and posts; refund partial sends `{amount: 1000}` and refuses an amount over the paid one before any request; a 409 `ALREADY_PAID` on cancel shows "Esta cobrança já foi paga.".

- [ ] **Step 2–4: Run red, implement, green; commit**

```bash
git add -A
git commit -m "feat(orders): checkout link panel, rotate, cancel and refund" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Checkout state machine and public API client (pure modules)

**Files:**
- Create: `src/checkout/types.ts`, `src/checkout/checkoutApi.ts`, `src/checkout/checkoutState.ts`, `src/checkout/checkoutState.test.ts`, `src/checkout/luhn.ts`, `src/checkout/luhn.test.ts`, `src/checkout/brand.ts`, `src/checkout/brand.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `Checkout`, `CheckoutPayment`, `Method = "PIX"|"BOLECODE"|"CARD"` per contract.
  - `checkoutApi.ts` (uses `request` WITHOUT apiKey): `getCheckout(token)`, `createAttempt(token, body)`, `getAttempt(token, id)`, `cancelAttempt(token, id)`.
  - `checkoutState.ts`:

```ts
export type State =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: "not_found" | "closed" }
  | { kind: "paid"; paidAt: string | null }
  | { kind: "choosing"; methods: Method[] }
  | { kind: "pix"; paymentId: string; copiaECola: string; expiresAt: string | null }
  | { kind: "boleto"; paymentId: string; linhaDigitavel: string; dueDate: string }
  | { kind: "card"; declined?: string }
  | { kind: "failed"; message: string };

export type Event =
  | { type: "loaded"; checkout: Checkout }
  | { type: "load_failed"; status: number }
  | { type: "choose"; method: Method }
  | { type: "attempt_created"; payment: CheckoutPayment }
  | { type: "attempt_failed"; code: string; message: string }
  | { type: "polled"; payment: CheckoutPayment }
  | { type: "cancelled" };

export function reduce(state: State, event: Event, checkout: Checkout | null): State;
export function fromCheckout(checkout: Checkout): State; // paid | unavailable(closed) | resumes active_payment of PIX/BOLECODE | choosing
```

  Rules: `loaded` with `status PAID` → `paid`; `CANCELED|EXPIRED` → `unavailable/closed`; `OPEN` with `active_payment` PIX pending → `pix` (resume, Review Focus 3); BOLECODE pending → `boleto`; CARD active (AUTHORIZED) → `choosing` is wrong, show `paid`-like "em processamento"? No: a CARD attempt is synchronous; an `AUTHORIZED` card attempt means the merchant will capture — treat as `paid` with `paidAt null` and copy "pagamento autorizado". `polled` with `COMPLETED` → `paid`; with `EXPIRED|CANCELED|FAILED` from `pix`/`boleto` → `choosing`; `attempt_created` CARD `COMPLETED|AUTHORIZED` → `paid`; CARD `FAILED` → `card` with `declined` message; `attempt_failed` with `CHECKOUT_ORDER_CLOSED` → `unavailable/closed`; `ORDER_HAS_ACTIVE_PAYMENT` → the UI reloads (`loading`); `RATE_LIMITED` → stays, UI shows the message (Review Focus 5 is a UI concern; the reducer returns the same state); `cancelled` → `choosing`.
  - `luhn.ts`: `isValidLuhn(digits: string): boolean`; `brand.ts`: `brandOf(digits): "visa"|"mastercard"|"amex"|"elo"|"hipercard"|null` (prefix table; icon only).

- [ ] **Step 1: Failing tests** — one `it` per rule above, including `anActivePixOnLoadResumesPolling` (fixture with `active_payment: {method:"PIX", status:"PENDING", pix:{…}}` → state `pix` with that `paymentId`), `aPaidOrderIsPaidOnLoad`, `aClosedOrderIsUnavailable`, `aDeclinedCardStaysOnCardWithTheMessage`, `anExpiredPixGoesBackToChoosing`, `aClosedErrorDuringAttemptIsUnavailable`; luhn with `4024007153763171` valid and `4024007153763172` invalid; brand prefixes.
- [ ] **Step 2–4: red, implement, green; commit**

```bash
git add -A
git commit -m "feat(checkout): state machine, luhn and brand detection as pure modules" -m "The reducer never holds card data: it stores payment ids only, so no state dump can carry a number." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Checkout screens

**Files:**
- Create: `src/checkout/PayPage.tsx`, `src/checkout/PayPage.test.tsx`, `src/checkout/ChooseMethod.tsx`, `src/checkout/PixStep.tsx`, `src/checkout/PixStep.test.tsx`, `src/checkout/BoletoStep.tsx`, `src/checkout/CardStep.tsx`, `src/checkout/CardStep.test.tsx`, `src/checkout/PaidScreen.tsx`, `src/checkout/UnavailableScreen.tsx`, `src/checkout/QrCode.tsx`, `src/checkout/cardDataNeverPersists.test.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- `PayPage`: loads `getCheckout(token)` (TanStack, key `["checkout", token]` — the token is a capability, not a secret from the merchant's point of view, but keep it out of logs), derives the initial state with `fromCheckout`, holds the `State` in `useReducer(reduce)`, renders the step for `state.kind`. Header: merchant name, `formatBrl(amount)`, description. Every (re)load re-derives from the API (Review Focus 4).
- `ChooseMethod`: buttons for each of `methods` (Pix, Boleto, Cartão); "Trocar de método" in Pix/Boleto steps calls `cancelAttempt` then dispatches `cancelled`.
- `PixStep`: `QrCode` (canvas via `qrcode.toCanvas`), copia-e-cola with "Copiar", countdown to `expiresAt`; polls `getAttempt` every 3 s (`useQuery` `refetchInterval`), dispatching `polled`; on a 429 pauses polling for `retryAfterSeconds` and shows "Muitas tentativas. Aguarde um instante." (Review Focus 5).
- `BoletoStep`: linha digitável + "Copiar", vencimento, polls every 30 s.
- `CardStep`: inputs número (formatted in groups of 4, Luhn check on blur, brand icon), nome, validade `MM/AA`, CVV (3–4 digits), parcelas (1–12 select); `autocomplete` attributes `cc-number`, `cc-name`, `cc-exp`, `cc-csc`; submit → `createAttempt(token, {method:"CARD", card:{number, holder, expiry, cvv}, installments})`; on any response (success or error) the form state is reset to empty strings BEFORE dispatching; 402 `CARD_DECLINED` → `attempt_failed` with message and the form stays for retry.
- `PaidScreen`: "Pagamento confirmado" (or "Pagamento autorizado" when `paidAt` null), valor, data, "Você pode fechar esta página."; `UnavailableScreen`: "Este link de pagamento não está mais disponível." / "Link inválido.".

- [ ] **Step 1: Failing tests** (MSW on `http://localhost:8080/v1/checkout/...`, no Authorization header asserted on every handler):
- `PayPage.test.tsx`: `aPaidOrderShowsPaidOnEveryLoad` (render twice with the same fixture; chooser never appears), `anOpenOrderShowsOnlyTheAvailableMethods` (`methods: ["PIX"]` → no Cartão button), `anUnknownTokenShowsInvalidLink` (404).
- `PixStep.test.tsx`: `pollsUntilCompletedThenShowsPaid` (fake timers: PENDING, PENDING, COMPLETED → "Pagamento confirmado"), `aRateLimitPausesPollingForRetryAfter` (429 with `Retry-After: 5` → no request for 5 s, message visible, then resumes).
- `CardStep.test.tsx`: `aDeclinedCardShowsTheMessageAndClearsTheFields` (402 → message, inputs empty), `anInvalidLuhnBlocksSubmit`, `aPaidCardShowsPaid`.
- `cardDataNeverPersists.test.tsx`: render `PayPage` in `card`, fill `4024007153763171`, `12/30`, `987`, submit (MSW 201 COMPLETED), then assert: `JSON.stringify(Object.entries(localStorage))`, `sessionStorage`, `JSON.stringify(queryClient.getQueryCache().getAll().map(q => q.state.data))`, `document.body.innerHTML` contain neither `4024007153763171`, `4024 0071 5376 3171`, nor the CVV token `987` as a standalone token, nor `12/30`.

- [ ] **Step 2–4: red, implement, green; commit**

```bash
git add -A
git commit -m "feat(checkout): payer screens for pix, boleto and card with polling" -m "Card fields are reset before the reducer hears the response, so no state, cache or storage ever holds a number." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: README, docs index, optional Playwright smoke

**Files:**
- Modify: `README.md` (how to run against a local gateway: `.env` with `VITE_API_URL`, the gateway needs `GATEWAY_CORS_ORIGINS=http://localhost:5173` and `GATEWAY_CHECKOUT_BASE_URL=http://localhost:5173/pay/`; screens; security notes; deploy on Vercel with the CSP host), `docs/superpowers/README.md` (index of spec + plan), `docs/superpowers/DECISOES.md` (the four decisions from spec §8, Portuguese, `Rejeitado:` / `Custo se errado:`)
- Create: `e2e/pix-smoke.spec.ts`, `playwright.config.ts` (`pnpm e2e`, not in CI), only if the gateway with WireMock is reachable; otherwise document the manual script in README and skip the file.

- [ ] **Step 1: Write docs; `pnpm lint && pnpm build`; commit**

```bash
git add -A
git commit -m "docs: how to run the panel and the checkout against a local gateway" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review notes

- Spec §3 "lista de ordens com cursor `X-Next-Cursor`": the gateway's lists use `cursor=<last id>` (payments pattern; orders/customers listing added on `feat/order-and-customer-listing`). Plan follows the real contract.
- Spec §4 "card AUTHORIZED": not in the spec; ruled as "pagamento autorizado" on the paid screen.
- Spec §6 Playwright smoke is optional and gated on a reachable gateway (Task 8).
- Every Review Focus line has a named test in Tasks 1, 2, 6, 7.
