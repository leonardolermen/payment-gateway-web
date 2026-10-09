# Panel as a Product, part 1: frame, login, settings, plans — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliveries 1–3 of the spec: the `Workspace` frame extracted, five navigation items, a polished login, a Settings page (account + installment interest with a live preview) and a Plans page — nothing here waits on the gateway.

**Architecture:** Same bundle and patterns as today: one concept folder per screen (`settings/`, `plan/`), API modules on `merchantRequest`, TanStack Query keys per concept, pure functions (`%` ↔ bps, installment preview, plan labels) tested without DOM. The frame of `OrdersWorkspace` moves to `support/ui/Workspace` so Customers and Subscriptions (parts 2 and 3) reuse it unchanged.

**Tech Stack:** React 19, TypeScript strict, React Router 7, TanStack Query 5, Tailwind 4, Vitest + Testing Library + MSW 2. `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

**Spec:** `docs/superpowers/specs/2026-10-08-painel-produto-design.md` (§1, §3, §5, §6, §7 rows 1–3, §8)

## Global Constraints

- Identifiers, comments and commit subjects in English; screen copy in pt-BR. Comments explain why. No `any`. One component per file; a file over ~200 lines is split.
- Folders are concepts (`settings/`, `plan/`), never roles; `support/` only for what every concept uses.
- Red first: a failing test precedes every behaviour. Before each commit: `pnpm test && pnpm typecheck && pnpm lint` green.
- The API key lives only in `sessionStorage["gateway.apiKey"]`; never in a URL, log, query key or `localStorage`. The Settings page shows at most its first 12 characters.
- Money in integer cents, shown with `formatBrl`; typed money parsed with `parseBrl` (both in `support/money.ts`). The API speaks bps for rates: `299` = `2,99%`; conversion lives in `settings/installmentApi.ts` only.
- API contract (gateway `main`, snake_case):
  - `GET /v1/merchant` → `{merchant_id, name, environment: "TEST"|"LIVE"}` (no key prefix: the panel derives it from the stored key).
  - `GET /v1/installment-settings` → `{environment, max_installments, interest_free_up_to, monthly_rate_bps, updated_at}`; `PUT /v1/installment-settings` body `{max_installments, interest_free_up_to, monthly_rate_bps}` → 200 same shape. Gateway limits: `1 ≤ max_installments ≤ 12`, `1 ≤ interest_free_up_to ≤ max_installments`, `0 ≤ monthly_rate_bps ≤ 1000`; violations are `400 INVALID_REQUEST` with the field name in `detail`.
  - `GET /v1/plans?active=true|false` → `PlanResponse[]`; `GET /v1/plans/{id}`; `POST /v1/plans` body `{name, amount, currency:"BRL", interval: "DAY"|"WEEK"|"MONTH"|"YEAR", interval_count, trial_days}` → 201; `PATCH /v1/plans/{id}` body `{name?, active?}` → 200; other fields → `422 PLAN_IMMUTABLE`.
  - `PlanResponse`: `{id, name, amount, currency, interval, interval_count, trial_days, active, created_at}`.
  - Errors are RFC 9457 problems `{type: "urn:gateway:<CODE>", status, detail, field?}`; `support/gatewayError.ts` already parses them.
- Installment pricing (mirror of the gateway's `InstallmentPricing`): `n ≤ interest_free_up_to` or rate 0 → `installment = floor(amount / n)`, `total = amount`; otherwise Price table `installment = ceil(amount × i / (1 − (1 + i)^−n))` in cents, `total = installment × n`; an option with `n > 1` and `installment < 500` cents is not offered; `1x` always is.

## Review Focus

1. A rate typed as `2,99`, `2.99` or `2,9` must all become bps `299`/`290` and round-trip back to `2,99%`/`2,90%`; `2,999` is refused (bps are whole). Pinned in Task 3 (`installmentApi.test.ts: percentTextAndBpsRoundTrip`).
2. The preview must match the gateway to the cent on its own test vectors, including the ceiling that turns `1234.000000000001` into `1234`, not `1235`. Pinned in Task 3 (`installmentPreview.test.ts: matchesTheGatewayVectors`).
3. Saving settings with `interest_free_up_to > max_installments` must be refused in the form before any request, naming the field. Pinned in Task 4 (`InstallmentSettingsForm.test.tsx: freeUpToAboveMaxIsRefusedLocally`).
4. A plan amount typed as `49,90` must be sent as `4990`, and a plan with `interval_count` 0 or empty name must not be sent. Pinned in Task 6 (`PlanForm.test.tsx: sendsCentsAndRefusesEmptyNameAndZeroCount`).
5. Extracting `Workspace` must not change what the orders tests see: same grid classes, same `order-first` behaviour on a phone with a selected order. Pinned in Task 1 by running the untouched `OrdersWorkspace.test.tsx` and by `Workspace.test.tsx: selectedPanelComesFirstBelowLg`.

---

### Task 1: Extract `Workspace` from `OrdersWorkspace`

**Files:**
- Create: `src/support/ui/Workspace.tsx`, `src/support/ui/Workspace.test.tsx`
- Modify: `src/order/OrdersWorkspace.tsx`
- Test (unchanged, must stay green): `src/order/OrdersWorkspace.test.tsx`

**Interfaces:**
- Produces: `Workspace({ selected: boolean; left: ReactNode; children: ReactNode })` — the two-column grid; `children` is the right panel (usually an `<Outlet />`). `WorkspaceEmpty({ children })` — the "pick something on the left" card, hidden below `lg`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/support/ui/Workspace.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Workspace, WorkspaceEmpty } from "./Workspace";

describe("Workspace", () => {
  it("selectedPanelComesFirstBelowLg", () => {
    render(
      <Workspace selected left={<p>list</p>}>
        <p>detail</p>
      </Workspace>,
    );

    const grid = screen.getByText("list").parentElement!.parentElement!;
    expect(grid).toHaveClass("grid", "lg:grid-cols-[1.15fr_0.85fr]");
    expect(screen.getByText("detail").parentElement).toHaveClass("order-first", "lg:order-none");
  });

  it("anUnselectedPanelKeepsItsPlace", () => {
    render(
      <Workspace selected={false} left={<p>list</p>}>
        <p>detail</p>
      </Workspace>,
    );

    expect(screen.getByText("detail").parentElement).not.toHaveClass("order-first");
  });

  it("emptyStateIsHiddenOnPhones", () => {
    render(<WorkspaceEmpty>Escolha algo</WorkspaceEmpty>);

    expect(screen.getByText("Escolha algo")).toHaveClass("hidden", "lg:block");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/support/ui/Workspace.test.tsx`
Expected: FAIL — cannot resolve `./Workspace`.

- [ ] **Step 3: Write `Workspace`**

```tsx
// src/support/ui/Workspace.tsx
import type { ReactNode } from "react";
import { Card } from "./Card";

type Props = { selected: boolean; left: ReactNode; children: ReactNode };

// The panel's two-column frame, as in the approved mockup: list (and form) on the left, the
// selected item on the right. One column below 1024px, with the selected item first so a tap on
// a row shows it without scrolling past the list.
export function Workspace({ selected, left, children }: Props) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
      <div className="min-w-0 space-y-5">{left}</div>

      <div className={`min-w-0 ${selected ? "order-first lg:order-none" : ""}`}>{children}</div>
    </div>
  );
}

export function WorkspaceEmpty({ children }: { children: ReactNode }) {
  return (
    // Only beside the list: on a phone it would sit alone under the form.
    <Card className="hidden text-sm text-muted lg:block">{children}</Card>
  );
}
```

- [ ] **Step 4: Make `OrdersWorkspace` use it**

```tsx
// src/order/OrdersWorkspace.tsx
import { useState } from "react";
import { Outlet, useMatch } from "react-router";
import { Workspace, WorkspaceEmpty } from "../support/ui/Workspace";
import { NewOrderForm } from "./NewOrderForm";
import { OrdersList } from "./OrdersList";

export function OrdersWorkspace() {
  const selected = useMatch("/app/orders/:id") !== null;
  // Bumped after a create: a fresh form is a fresh idempotency key, and the next charge starts empty.
  const [formGeneration, setFormGeneration] = useState(0);

  function focusNewOrder() {
    const amount = document.getElementById("amount");
    amount?.scrollIntoView({ block: "center", behavior: "smooth" });
    amount?.focus({ preventScroll: true });
  }

  return (
    <Workspace
      selected={selected}
      left={
        <>
          <OrdersList onNewOrder={focusNewOrder} />
          <NewOrderForm
            key={formGeneration}
            onCreated={() => setFormGeneration((generation) => generation + 1)}
          />
        </>
      }
    >
      <Outlet />
    </Workspace>
  );
}

export function NoOrderSelected() {
  return (
    <WorkspaceEmpty>
      Escolha uma cobrança na lista para ver o link, as tentativas e as ações.
    </WorkspaceEmpty>
  );
}
```

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all green, `OrdersWorkspace.test.tsx` untouched and passing (this is a refactor; if it needed a test change, it was not one).

- [ ] **Step 6: Commit**

```bash
git add src/support/ui/Workspace.tsx src/support/ui/Workspace.test.tsx src/order/OrdersWorkspace.tsx
git commit -m "refactor(ui): the two-column frame leaves OrdersWorkspace for support/ui/Workspace"
```

---

### Task 2: Login with a product face

**Files:**
- Modify: `src/auth/LoginPage.tsx`, `src/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `getMerchant(apiKey)`, `storeApiKey`, `Button`, `Card`, `Field`, `INPUT_CLASSES`, `Badge`.
- Produces: nothing new; same route, same storage.

- [ ] **Step 1: Add the failing tests**

Append to `src/auth/LoginPage.test.tsx` inside `describe("LoginPage")`:

```tsx
  it("showToggleRevealsTheKeyWithoutChangingIt", async () => {
    renderWithProviders(routes, { initialEntries: ["/app/login"] });
    const input = screen.getByLabelText("Chave de API");

    await userEvent.type(input, "gk_test_abc");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("gk_test_abc");
    expect(screen.getByRole("button", { name: "Ocultar" })).toBeInTheDocument();
  });

  it("explainsWhereTheKeyComesFromAndWhatTheEnvironmentMeans", () => {
    renderWithProviders(routes, { initialEntries: ["/app/login"] });

    expect(screen.getByRole("heading", { name: "Entrar no painel" })).toBeInTheDocument();
    expect(screen.getByText(/gk_test_/)).toBeInTheDocument();
    expect(screen.getByText(/não movem dinheiro/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run src/auth/LoginPage.test.tsx`
Expected: the two new tests FAIL (no "Mostrar" button, no explanatory copy); the three old ones pass.

- [ ] **Step 3: Rewrite `LoginPage`**

```tsx
// src/auth/LoginPage.tsx
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { storeApiKey } from "./apiKey";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { ThemeToggle } from "../support/ui/ThemeToggle";
import { getMerchant } from "./merchantApi";

// Same-origin paths only: `next` comes from the URL and must not become an open redirect.
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app/orders";
}

// Still a key, not a password: e-mail/password login is the gateway's next project (spec §5).
export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [key, setKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);

    try {
      const trimmed = key.trim();
      await getMerchant(trimmed);
      storeApiKey(trimmed);
      // Whatever is cached belongs to a previous key; the new session starts empty.
      queryClient.clear();
      navigate(safeNext(params.get("next")), { replace: true });
    } catch {
      // Fixed copy: the server detail is not for the screen, and a network failure reads the same here.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg px-4 pt-20 text-ink">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="size-9 rounded-[10px] bg-accent" />
          <div className="min-w-0">
            <p className="font-chrome text-[11px] font-semibold tracking-wider text-muted uppercase">
              Payment Gateway
            </p>
            <h1 className="font-display text-2xl font-semibold">Entrar no painel</h1>
          </div>
          <span className="ml-auto">
            <ThemeToggle />
          </span>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Chave de API"
              htmlFor="api-key"
              hint={
                <>
                  A chave começa com <code>gk_test_</code> ou <code>gk_live_</code> e foi entregue
                  pelo operador. Chaves de teste não movem dinheiro.
                </>
              }
            >
              <div className="flex gap-2">
                <input
                  id="api-key"
                  type={revealed ? "text" : "password"}
                  name="chave"
                  autoComplete="off"
                  spellCheck={false}
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  className={`${INPUT_CLASSES} font-mono`}
                />
                <Button variant="ghost" onClick={() => setRevealed((shown) => !shown)}>
                  {revealed ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
            </Field>
            {failed && (
              <p role="alert" className="text-sm text-danger">
                Chave de API inválida.
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy || key.trim() === ""}>
              Entrar
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted">
          A chave fica só nesta aba e some quando ela fecha.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run the suite**

Run: `pnpm vitest run src/auth && pnpm typecheck && pnpm lint`
Expected: PASS. (`getByLabelText("Chave de API")` still resolves: `Field` renders a `<label htmlFor>`.)

- [ ] **Step 5: Commit**

```bash
git add src/auth/LoginPage.tsx src/auth/LoginPage.test.tsx
git commit -m "feat(login): brand, show/hide, and where the key comes from"
```

---

### Task 3: Installment settings API, `%` ↔ bps, and the preview (pure)

**Files:**
- Create: `src/settings/types.ts`, `src/settings/installmentApi.ts`, `src/settings/installmentApi.test.ts`, `src/settings/installmentPreview.ts`, `src/settings/installmentPreview.test.ts`

**Interfaces:**
- Consumes: `merchantRequest`.
- Produces:
  - `type InstallmentSettings = { environment: "TEST"|"LIVE"; max_installments: number; interest_free_up_to: number; monthly_rate_bps: number; updated_at: string }`; `type InstallmentSettingsInput = { max_installments: number; interest_free_up_to: number; monthly_rate_bps: number }`.
  - `settingsKeys = { installments: ["settings", "installments"] as const }`; `getInstallmentSettings(): Promise<InstallmentSettings>`; `putInstallmentSettings(input): Promise<InstallmentSettings>`.
  - `percentToBps(text: string): number | null` (`"2,99"` → `299`; `""`/`"abc"`/`"2,999"` → `null`); `bpsToPercent(bps: number): string` (`299` → `"2,99"`).
  - `type InstallmentPreview = { count: number; installment: number; total: number; interestFree: boolean }`; `previewInstallments(amount: number, input: InstallmentSettingsInput): InstallmentPreview[]`.

- [ ] **Step 1: Write the failing conversion tests**

```ts
// src/settings/installmentApi.test.ts
import { describe, expect, it } from "vitest";
import { bpsToPercent, percentToBps } from "./installmentApi";

describe("percent and bps", () => {
  it("percentTextAndBpsRoundTrip", () => {
    expect(percentToBps("2,99")).toBe(299);
    expect(percentToBps("2.99")).toBe(299);
    expect(percentToBps("2,9")).toBe(290);
    expect(percentToBps("10")).toBe(1000);
    expect(percentToBps("0")).toBe(0);
    expect(bpsToPercent(299)).toBe("2,99");
    expect(bpsToPercent(290)).toBe("2,90");
    expect(bpsToPercent(0)).toBe("0,00");
    expect(bpsToPercent(percentToBps("1,5")!)).toBe("1,50");
  });

  it("refusesWhatIsNotAWholeBps", () => {
    expect(percentToBps("")).toBeNull();
    expect(percentToBps("abc")).toBeNull();
    expect(percentToBps("2,999")).toBeNull();
    expect(percentToBps("-1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/settings/installmentApi.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write types and the API module**

```ts
// src/settings/types.ts
// Field names mirror the API (snake_case) on purpose, as in order/types.ts.
export type InstallmentSettings = {
  environment: "TEST" | "LIVE";
  max_installments: number;
  interest_free_up_to: number;
  monthly_rate_bps: number;
  updated_at: string;
};

export type InstallmentSettingsInput = {
  max_installments: number;
  interest_free_up_to: number;
  monthly_rate_bps: number;
};
```

```ts
// src/settings/installmentApi.ts
import { merchantRequest } from "../support/merchantRequest";
import type { InstallmentSettings, InstallmentSettingsInput } from "./types";

export const settingsKeys = {
  installments: ["settings", "installments"] as const,
};

export async function getInstallmentSettings(): Promise<InstallmentSettings> {
  const { data } = await merchantRequest<InstallmentSettings>("/v1/installment-settings");
  return data;
}

export async function putInstallmentSettings(
  input: InstallmentSettingsInput,
): Promise<InstallmentSettings> {
  const { data } = await merchantRequest<InstallmentSettings>("/v1/installment-settings", {
    method: "PUT",
    body: input,
  });
  return data;
}

// The screen speaks "2,99%", the API speaks 299 bps. Done on strings: 2.99 * 100 is 298.99999…
// in floating point, and a rate one bps short is a price the merchant did not set.
export function percentToBps(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) {
    return null;
  }

  const [, whole, fraction = ""] = match;
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

export function bpsToPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const fraction = String(bps % 100).padStart(2, "0");
  return `${whole},${fraction}`;
}
```

- [ ] **Step 4: Run the conversion tests**

Run: `pnpm vitest run src/settings/installmentApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing preview test — the gateway's own vectors**

```ts
// src/settings/installmentPreview.test.ts
import { describe, expect, it } from "vitest";
import { previewInstallments } from "./installmentPreview";

function settings(max: number, freeUpTo: number, bps: number) {
  return { max_installments: max, interest_free_up_to: freeUpTo, monthly_rate_bps: bps };
}

// Every number here comes from the gateway's InstallmentPricingTest. A divergence is a bug here.
describe("previewInstallments", () => {
  it("matchesTheGatewayVectors", () => {
    const options = previewInstallments(10000, settings(12, 1, 299));

    expect(options[2]).toEqual({ count: 3, installment: 3535, total: 10605, interestFree: false });
    expect(options[5]).toEqual({ count: 6, installment: 1846, total: 11076, interestFree: false });
  });

  it("interestFreeOnesAreTruncatedAndTotalTheAmount", () => {
    const options = previewInstallments(10000, settings(10, 3, 299));

    expect(options).toHaveLength(10);
    expect(options.slice(0, 3).every((option) => option.interestFree && option.total === 10000)).toBe(true);
    expect(options[3]).toEqual({ count: 4, installment: 2690, total: 10760, interestFree: false });
    expect(options[9]).toEqual({ count: 10, installment: 1172, total: 11720, interestFree: false });
  });

  it("aZeroRateIsAllInterestFree", () => {
    const options = previewInstallments(10000, settings(12, 1, 0));

    expect(options).toHaveLength(12);
    expect(options.every((option) => option.interestFree && option.total === 10000)).toBe(true);
    expect(options[11]).toEqual({ count: 12, installment: 833, total: 10000, interestFree: true });
  });

  it("anInstallmentUnderFiveReaisIsNotOffered", () => {
    const counts = previewInstallments(2000, settings(12, 1, 299)).map((option) => option.count);

    expect(counts).toEqual([1, 2, 3, 4]);
    expect(previewInstallments(300, settings(12, 12, 0)).map((option) => option.count)).toEqual([1]);
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `pnpm vitest run src/settings/installmentPreview.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write the preview**

```ts
// src/settings/installmentPreview.ts
import type { InstallmentSettingsInput } from "./types";

export type InstallmentPreview = {
  count: number;
  installment: number;
  total: number;
  interestFree: boolean;
};

// R$ 5,00: the acquirer's minimum per installment, same rule as the gateway.
const MINIMUM_INSTALLMENT_CENTS = 500;

// DECIMAL64 noise in the gateway is 1e-16; a whole-cent installment can come out as 1234.000000000001
// in doubles too, and ceiling that would show a cent nobody will be charged. Round to six places
// first, as the gateway does.
const NOISE_SCALE = 1e6;

/**
 * A copy of the gateway's InstallmentPricing (spec §5): the merchant sees here exactly what the
 * payer will see on the checkout. The test pins it to the gateway's own vectors.
 */
export function previewInstallments(
  amount: number,
  input: InstallmentSettingsInput,
): InstallmentPreview[] {
  const options: InstallmentPreview[] = [];
  for (let count = 1; count <= input.max_installments; count++) {
    const option = price(amount, input, count);
    if (count === 1 || option.installment >= MINIMUM_INSTALLMENT_CENTS) {
      options.push(option);
    }
  }

  return options;
}

function price(amount: number, input: InstallmentSettingsInput, count: number): InstallmentPreview {
  if (count <= input.interest_free_up_to || input.monthly_rate_bps === 0) {
    return { count, installment: Math.floor(amount / count), total: amount, interestFree: true };
  }

  const rate = input.monthly_rate_bps / 10_000;
  const raw = (amount * rate) / (1 - Math.pow(1 + rate, -count));
  const installment = Math.ceil(Math.round(raw * NOISE_SCALE) / NOISE_SCALE);

  return { count, installment, total: installment * count, interestFree: false };
}
```

- [ ] **Step 8: Run the preview tests**

Run: `pnpm vitest run src/settings && pnpm typecheck && pnpm lint`
Expected: PASS. If `matchesTheGatewayVectors` is off by one cent on any vector, the arithmetic order differs from the gateway's (`amount × rate` first, then divide): fix the formula, never the vector.

- [ ] **Step 9: Commit**

```bash
git add src/settings
git commit -m "feat(settings): installment settings api, percent-bps conversion and the price preview"
```

---

### Task 4: Settings page — Tabs, account, installment form with preview

**Files:**
- Create: `src/support/ui/Tabs.tsx`, `src/support/ui/Tabs.test.tsx`
- Create: `src/settings/SettingsPage.tsx`, `src/settings/AccountSection.tsx`, `src/settings/InstallmentSettingsForm.tsx`, `src/settings/InstallmentSettingsForm.test.tsx`, `src/settings/SettingsPage.test.tsx`
- Modify: `src/app/router.tsx`, `src/app/AppLayout.tsx`, `src/app/AppLayout.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`settingsKeys`, `getInstallmentSettings`, `putInstallmentSettings`, `percentToBps`, `bpsToPercent`, `previewInstallments`), `useMerchant`, `readApiKey`, `MoneyInput` (from `order/`), `Field`, `TextField`, `Button`, `Card`, `Badge`, `PageHeader`, `Table`, `messageFor`.
- Produces: `Tabs({ tabs: { id: string; label: string }[]; selected: string; onSelect: (id) => void })` with `role="tablist"`; route `/app/settings`; nav item "Configurações".

- [ ] **Step 1: Failing `Tabs` test**

```tsx
// src/support/ui/Tabs.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  it("marksTheSelectedTabAndReportsAClick", async () => {
    const onSelect = vi.fn();
    render(
      <Tabs
        tabs={[
          { id: "account", label: "Conta" },
          { id: "installments", label: "Parcelamento" },
        ]}
        selected="account"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("tab", { name: "Conta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Parcelamento" })).toHaveAttribute("aria-selected", "false");

    await userEvent.click(screen.getByRole("tab", { name: "Parcelamento" }));
    expect(onSelect).toHaveBeenCalledWith("installments");
  });
});
```

- [ ] **Step 2: Run, see it fail; write `Tabs`**

```tsx
// src/support/ui/Tabs.tsx
type Tab = { id: string; label: string };
type Props = { tabs: Tab[]; selected: string; onSelect: (id: string) => void };

// Same accent bar as the header nav, so a tab reads as "the same kind of thing" one level down.
export function Tabs({ tabs, selected, onSelect }: Props) {
  return (
    <div role="tablist" className="flex gap-4 border-b border-line font-chrome text-[13px]">
      {tabs.map((tab) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(tab.id)}
            className={`-mb-px border-b-2 px-1 py-2 font-medium ${
              isSelected ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
```

Run: `pnpm vitest run src/support/ui/Tabs.test.tsx` → PASS.

- [ ] **Step 3: Failing form test**

```tsx
// src/settings/InstallmentSettingsForm.test.tsx
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { InstallmentSettingsForm } from "./InstallmentSettingsForm";

const current = {
  environment: "TEST",
  max_installments: 12,
  interest_free_up_to: 3,
  monthly_rate_bps: 299,
  updated_at: "2026-10-01T12:00:00Z",
};

function renderForm() {
  storeApiKey("gk_test_abc");
  server.use(http.get("http://localhost:8080/v1/installment-settings", () => HttpResponse.json(current)));
  return renderWithProviders([{ path: "/", element: <InstallmentSettingsForm /> }]);
}

describe("InstallmentSettingsForm", () => {
  it("loadsTheCurrentValuesAndPreviewsThem", async () => {
    renderForm();

    expect(await screen.findByLabelText("Máximo de parcelas")).toHaveValue(12);
    expect(screen.getByLabelText("Sem juros até")).toHaveValue(3);
    expect(screen.getByLabelText("Juros ao mês (%)")).toHaveValue("2,99");

    const preview = screen.getByRole("table", { name: "Prévia das parcelas" });
    // 10000 cents, free up to 3, 2.99%: the gateway's own vector for 4x.
    expect(within(preview).getByText("4x de R$ 26,90")).toBeInTheDocument();
    expect(within(preview).getByText("R$ 107,60")).toBeInTheDocument();
    expect(within(preview).getByText("3x de R$ 33,33")).toBeInTheDocument();
  });

  it("sendsBpsAndShowsTheSavedState", async () => {
    let sent: unknown = null;
    server.use(
      http.put("http://localhost:8080/v1/installment-settings", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...current, monthly_rate_bps: 150, updated_at: "2026-10-08T10:00:00Z" });
      }),
    );
    renderForm();
    const rate = await screen.findByLabelText("Juros ao mês (%)");

    await userEvent.clear(rate);
    await userEvent.type(rate, "1,5");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(/Salvo/)).toBeInTheDocument();
    expect(sent).toEqual({ max_installments: 12, interest_free_up_to: 3, monthly_rate_bps: 150 });
  });

  it("freeUpToAboveMaxIsRefusedLocally", async () => {
    let called = false;
    server.use(
      http.put("http://localhost:8080/v1/installment-settings", () => {
        called = true;
        return HttpResponse.json(current);
      }),
    );
    renderForm();
    const freeUpTo = await screen.findByLabelText("Sem juros até");

    await userEvent.clear(freeUpTo);
    await userEvent.type(freeUpTo, "13");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Não pode passar do máximo de parcelas.")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("aGatewayValidationErrorLandsAtTheTop", async () => {
    server.use(
      http.put("http://localhost:8080/v1/installment-settings", () =>
        HttpResponse.json(
          { type: "urn:gateway:INVALID_REQUEST", status: 400, detail: "monthly_rate_bps must be between 0 and 1000" },
          { status: 400 },
        ),
      ),
    );
    renderForm();
    await screen.findByLabelText("Máximo de parcelas");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Requisição inválida.");
  });
});
```

- [ ] **Step 4: Run, see it fail; write the form**

```tsx
// src/settings/InstallmentSettingsForm.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { formatBrl } from "../support/money";
import { MoneyInput } from "../order/MoneyInput";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { Table } from "../support/ui/Table";
import { TextField } from "../customer/TextField";
import { formatDateTime } from "../support/dates";
import { bpsToPercent, getInstallmentSettings, percentToBps, putInstallmentSettings, settingsKeys } from "./installmentApi";
import { previewInstallments } from "./installmentPreview";

const MAX_CEILING = 12;
const SAMPLE_AMOUNT = 100_000;

type Errors = { max?: string; freeUpTo?: string; rate?: string };

export function InstallmentSettingsForm() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: settingsKeys.installments, queryFn: getInstallmentSettings });

  const [max, setMax] = useState("");
  const [freeUpTo, setFreeUpTo] = useState("");
  const [rate, setRate] = useState("");
  const [sample, setSample] = useState<number | null>(SAMPLE_AMOUNT);
  const [errors, setErrors] = useState<Errors>({});

  // The form is seeded once from the server; after that the merchant's typing wins.
  useEffect(() => {
    if (settings.data) {
      setMax(String(settings.data.max_installments));
      setFreeUpTo(String(settings.data.interest_free_up_to));
      setRate(bpsToPercent(settings.data.monthly_rate_bps));
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: putInstallmentSettings,
    onSuccess: (saved) => queryClient.setQueryData(settingsKeys.installments, saved),
  });

  const maxNumber = Number(max);
  const freeUpToNumber = Number(freeUpTo);
  const bps = percentToBps(rate);
  const previewable = Number.isInteger(maxNumber) && maxNumber >= 1 && Number.isInteger(freeUpToNumber) && bps !== null;

  function validate(): Errors {
    const next: Errors = {};
    if (!Number.isInteger(maxNumber) || maxNumber < 1 || maxNumber > MAX_CEILING) {
      next.max = `Entre 1 e ${MAX_CEILING}.`;
    }
    if (!Number.isInteger(freeUpToNumber) || freeUpToNumber < 1) {
      next.freeUpTo = "Pelo menos 1.";
    } else if (freeUpToNumber > maxNumber) {
      next.freeUpTo = "Não pode passar do máximo de parcelas.";
    }
    if (bps === null || bps > 1000) {
      next.rate = "Entre 0,00 e 10,00.";
    }
    return next;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0 || bps === null) {
      return;
    }

    save.mutate({ max_installments: maxNumber, interest_free_up_to: freeUpToNumber, monthly_rate_bps: bps });
  }

  if (settings.isError) {
    return <p role="alert" className="text-danger">{messageFor(settings.error)}</p>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <TextField
            label="Máximo de parcelas"
            id="max-installments"
            type="number"
            min={1}
            max={MAX_CEILING}
            value={max}
            error={errors.max}
            onChange={(event) => setMax(event.target.value)}
          />
          <TextField
            label="Sem juros até"
            id="interest-free-up-to"
            type="number"
            min={1}
            value={freeUpTo}
            error={errors.freeUpTo}
            onChange={(event) => setFreeUpTo(event.target.value)}
          />
          <TextField
            label="Juros ao mês (%)"
            id="monthly-rate"
            inputMode="decimal"
            value={rate}
            error={errors.rate}
            onChange={(event) => setRate(event.target.value)}
          />
          {save.isError && (
            <p role="alert" className="text-sm text-danger">
              {messageFor(save.error)}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={save.isPending || settings.isPending}>
              Salvar
            </Button>
            {save.isSuccess && settings.data && (
              <span className="text-xs text-muted">Salvo em {formatDateTime(settings.data.updated_at)}</span>
            )}
          </div>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">O que o pagador vê</h2>
        <MoneyInput valueCents={sample} onChange={setSample} />
        {previewable && sample !== null && (
          <table className="w-full text-left text-sm" aria-label="Prévia das parcelas">
            <tbody className="divide-y divide-line [&_td]:py-1.5">
              {previewInstallments(sample, {
                max_installments: maxNumber,
                interest_free_up_to: freeUpToNumber,
                monthly_rate_bps: bps,
              }).map((option) => (
                <tr key={option.count}>
                  <td>{`${option.count}x de ${formatBrl(option.installment)}`}</td>
                  <td className="text-muted">{option.interestFree ? "sem juros" : "com juros"}</td>
                  <td className="text-right">{formatBrl(option.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
```

Note: `Table` from `support/ui` is not used for the preview because it has no `aria-label`; a plain table keeps the test's `getByRole("table", { name })` honest. If the file passes ~200 lines, move the preview card to `settings/InstallmentPreviewCard.tsx` with props `{ settings: InstallmentSettingsInput | null }`.

Run: `pnpm vitest run src/settings/InstallmentSettingsForm.test.tsx` → PASS.

- [ ] **Step 5: Failing page test (account tab, key prefix, tabs)**

```tsx
// src/settings/SettingsPage.test.tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("showsTheMerchantTheEnvironmentAndOnlyTheKeyPrefix", async () => {
    storeApiKey("gk_test_abcdefghijklmnop");
    server.use(
      http.get("http://localhost:8080/v1/merchant", () =>
        HttpResponse.json({ merchant_id: "m_1", name: "Loja de Dev", environment: "TEST" }),
      ),
    );
    renderWithProviders([{ path: "/app/settings", element: <SettingsPage /> }], {
      initialEntries: ["/app/settings"],
    });

    expect(await screen.findByText("Loja de Dev")).toBeInTheDocument();
    expect(screen.getByText(/não movem dinheiro/)).toBeInTheDocument();
    expect(screen.getByText("gk_test_abcd…")).toBeInTheDocument();
    expect(screen.queryByText(/abcdefghijklmnop/)).not.toBeInTheDocument();
  });

  it("switchesToTheInstallmentsTab", async () => {
    storeApiKey("gk_test_abc");
    server.use(
      http.get("http://localhost:8080/v1/merchant", () =>
        HttpResponse.json({ merchant_id: "m_1", name: "Loja", environment: "LIVE" }),
      ),
      http.get("http://localhost:8080/v1/installment-settings", () =>
        HttpResponse.json({ environment: "LIVE", max_installments: 6, interest_free_up_to: 6, monthly_rate_bps: 0, updated_at: "2026-10-01T12:00:00Z" }),
      ),
    );
    renderWithProviders([{ path: "/app/settings", element: <SettingsPage /> }], {
      initialEntries: ["/app/settings"],
    });

    await userEvent.click(await screen.findByRole("tab", { name: "Parcelamento" }));

    expect(await screen.findByLabelText("Máximo de parcelas")).toHaveValue(6);
  });
});
```

- [ ] **Step 6: Run, see it fail; write `AccountSection` and `SettingsPage`**

```tsx
// src/settings/AccountSection.tsx
import { readApiKey } from "../auth/apiKey";
import { useMerchant } from "../auth/useMerchant";
import { Badge, type BadgeTone } from "../support/ui/Badge";
import { Card } from "../support/ui/Card";

const ENVIRONMENT_TONE: Record<"TEST" | "LIVE", BadgeTone> = { TEST: "warn", LIVE: "ok" };
const ENVIRONMENT_COPY: Record<"TEST" | "LIVE", string> = {
  TEST: "Esta chave é de teste: cobranças feitas aqui não movem dinheiro.",
  LIVE: "Esta chave é de produção: cobranças feitas aqui movem dinheiro de verdade.",
};

// Twelve characters is "gk_test_" plus four: enough to tell two keys apart, never enough to use one.
function keyPrefix(): string | null {
  const key = readApiKey();
  return key ? `${key.slice(0, 12)}…` : null;
}

// When password login arrives, the key moves in here as something the merchant creates (spec §5).
export function AccountSection() {
  const merchant = useMerchant();
  const prefix = keyPrefix();

  return (
    <Card className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">Loja</dt>
          <dd className="font-medium">{merchant.data?.name ?? "…"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">Ambiente</dt>
          <dd className="space-y-1">
            {merchant.data && (
              <>
                <Badge tone={ENVIRONMENT_TONE[merchant.data.environment]}>{merchant.data.environment}</Badge>
                <p className="text-xs text-muted">{ENVIRONMENT_COPY[merchant.data.environment]}</p>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">Chave em uso</dt>
          <dd className="font-mono text-sm">{prefix ?? "—"}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted">
        Chaves são criadas e rotacionadas pelo operador do gateway. Para trocar de chave, saia e
        entre com a nova.
      </p>
    </Card>
  );
}
```

```tsx
// src/settings/SettingsPage.tsx
import { useState } from "react";
import { PageHeader } from "../support/ui/PageHeader";
import { Tabs } from "../support/ui/Tabs";
import { AccountSection } from "./AccountSection";
import { InstallmentSettingsForm } from "./InstallmentSettingsForm";

const TABS = [
  { id: "account", label: "Conta" },
  { id: "installments", label: "Parcelamento" },
];

export function SettingsPage() {
  const [tab, setTab] = useState("account");

  return (
    <section className="space-y-4">
      <PageHeader title="Configurações" />
      <Tabs tabs={TABS} selected={tab} onSelect={setTab} />
      {tab === "account" ? <AccountSection /> : <InstallmentSettingsForm />}
    </section>
  );
}
```

Run: `pnpm vitest run src/settings` → PASS.

- [ ] **Step 7: Route and nav item, with the layout test extended**

In `src/app/AppLayout.test.tsx`, inside the first test after the Clientes assertion, add:

```tsx
    expect(within(nav).getByRole("link", { name: "Configurações" })).toHaveAttribute("href", "/app/settings");
```

Run `pnpm vitest run src/app` → FAIL (no such link). Then in `src/app/AppLayout.tsx` add after the Clientes `NavLink`:

```tsx
            <NavLink to="/app/settings" className={navClass}>
              Configurações
            </NavLink>
```

And in `src/app/router.tsx`, import `SettingsPage` and add under the `AppLayout` children, after `customers/new`:

```tsx
          { path: "settings", element: <SettingsPage /> },
```

Run: `pnpm test && pnpm typecheck && pnpm lint` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/support/ui/Tabs.tsx src/support/ui/Tabs.test.tsx src/settings src/app
git commit -m "feat(settings): account tab and installment interest with the payer's preview"
```

---

### Task 5: Plan API, types and labels (pure)

**Files:**
- Create: `src/plan/types.ts`, `src/plan/planApi.ts`, `src/plan/planLabels.ts`, `src/plan/planLabels.test.ts`

**Interfaces:**
- Consumes: `merchantRequest`, `formatBrl`.
- Produces:
  - `type PlanInterval = "DAY"|"WEEK"|"MONTH"|"YEAR"`; `type Plan = { id; name; amount; currency; interval: PlanInterval; interval_count; trial_days; active; created_at }`; `type NewPlan = { name; amount; currency: "BRL"; interval; interval_count; trial_days }`; `type PlanPatch = { name?: string; active?: boolean }`.
  - `planKeys = { all: ["plans"], list: (active?: boolean) => ["plans","list",{active}], detail: (id) => ["plans", id] }`; `listPlans(active?: boolean): Promise<Plan[]>`; `createPlan(body: NewPlan, idempotencyKey: string): Promise<Plan>`; `patchPlan(id: string, body: PlanPatch): Promise<Plan>`.
  - `priceLabel(plan: Pick<Plan, "amount"|"interval"|"interval_count">): string` → `"R$ 49,90 / mês"`, `"R$ 120,00 a cada 3 meses"`, `"R$ 10,00 / semana"`, `"R$ 1,00 a cada 2 dias"`, `"R$ 500,00 / ano"`; `trialLabel(days: number): string` → `"sem trial"`, `"1 dia"`, `"7 dias"`.

- [ ] **Step 1: Failing label test**

```ts
// src/plan/planLabels.test.ts
import { describe, expect, it } from "vitest";
import { priceLabel, trialLabel } from "./planLabels";

describe("plan labels", () => {
  it("singleIntervalsReadAsPer", () => {
    expect(priceLabel({ amount: 4990, interval: "MONTH", interval_count: 1 })).toBe("R$ 49,90 / mês");
    expect(priceLabel({ amount: 1000, interval: "WEEK", interval_count: 1 })).toBe("R$ 10,00 / semana");
    expect(priceLabel({ amount: 50000, interval: "YEAR", interval_count: 1 })).toBe("R$ 500,00 / ano");
    expect(priceLabel({ amount: 100, interval: "DAY", interval_count: 1 })).toBe("R$ 1,00 / dia");
  });

  it("multipleIntervalsReadAsEvery", () => {
    expect(priceLabel({ amount: 12000, interval: "MONTH", interval_count: 3 })).toBe("R$ 120,00 a cada 3 meses");
    expect(priceLabel({ amount: 100, interval: "DAY", interval_count: 2 })).toBe("R$ 1,00 a cada 2 dias");
    expect(priceLabel({ amount: 100, interval: "WEEK", interval_count: 2 })).toBe("R$ 1,00 a cada 2 semanas");
    expect(priceLabel({ amount: 100, interval: "YEAR", interval_count: 2 })).toBe("R$ 1,00 a cada 2 anos");
  });

  it("trialReadsInDays", () => {
    expect(trialLabel(0)).toBe("sem trial");
    expect(trialLabel(1)).toBe("1 dia");
    expect(trialLabel(7)).toBe("7 dias");
  });
});
```

- [ ] **Step 2: Run, see it fail; write types, labels and API**

```ts
// src/plan/types.ts
export type PlanInterval = "DAY" | "WEEK" | "MONTH" | "YEAR";

// Field names mirror the API (snake_case) on purpose, as in order/types.ts.
export type Plan = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: PlanInterval;
  interval_count: number;
  trial_days: number;
  active: boolean;
  created_at: string;
};

export type NewPlan = {
  name: string;
  amount: number;
  currency: "BRL";
  interval: PlanInterval;
  interval_count: number;
  trial_days: number;
};

// Only these two change after creation; the gateway answers PLAN_IMMUTABLE to anything else.
export type PlanPatch = { name?: string; active?: boolean };
```

```ts
// src/plan/planLabels.ts
import { formatBrl } from "../support/money";
import type { Plan, PlanInterval } from "./types";

const SINGULAR: Record<PlanInterval, string> = { DAY: "dia", WEEK: "semana", MONTH: "mês", YEAR: "ano" };
const PLURAL: Record<PlanInterval, string> = { DAY: "dias", WEEK: "semanas", MONTH: "meses", YEAR: "anos" };

export function priceLabel(plan: Pick<Plan, "amount" | "interval" | "interval_count">): string {
  const price = formatBrl(plan.amount);
  if (plan.interval_count === 1) {
    return `${price} / ${SINGULAR[plan.interval]}`;
  }

  return `${price} a cada ${plan.interval_count} ${PLURAL[plan.interval]}`;
}

export function trialLabel(days: number): string {
  if (days === 0) {
    return "sem trial";
  }

  return days === 1 ? "1 dia" : `${days} dias`;
}
```

```ts
// src/plan/planApi.ts
import { merchantRequest } from "../support/merchantRequest";
import type { NewPlan, Plan, PlanPatch } from "./types";

export const planKeys = {
  all: ["plans"] as const,
  list: (active?: boolean) => ["plans", "list", { active }] as const,
  detail: (id: string) => ["plans", id] as const,
};

export async function listPlans(active?: boolean): Promise<Plan[]> {
  const query = active === undefined ? "" : `?active=${active}`;
  const { data } = await merchantRequest<Plan[]>(`/v1/plans${query}`);
  return data;
}

export async function createPlan(body: NewPlan, idempotencyKey: string): Promise<Plan> {
  const { data } = await merchantRequest<Plan>("/v1/plans", { method: "POST", body, idempotencyKey });
  return data;
}

export async function patchPlan(id: string, body: PlanPatch): Promise<Plan> {
  const { data } = await merchantRequest<Plan>(`/v1/plans/${id}`, { method: "PATCH", body });
  return data;
}
```

Run: `pnpm vitest run src/plan && pnpm typecheck && pnpm lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/plan
git commit -m "feat(plans): api, types and the price and trial labels"
```

---

### Task 6: Plans page with create and edit dialogs

**Files:**
- Create: `src/plan/PlansPage.tsx`, `src/plan/PlansPage.test.tsx`, `src/plan/PlanForm.tsx`, `src/plan/PlanForm.test.tsx`, `src/plan/EditPlanDialog.tsx`
- Modify: `src/app/router.tsx`, `src/app/AppLayout.tsx`, `src/app/AppLayout.test.tsx`

**Interfaces:**
- Consumes: Task 5, `MoneyInput`, `TextField`, `Field`, `INPUT_CLASSES`, `Button`, `Card`, `Badge`, `PageHeader`, `Table`, `messageFor`, `useIdempotencyKey`, `formatDateTime`.
- Produces: `PlanForm({ onCreated: (plan: Plan) => void; onCancel: () => void })` in an overlay; `EditPlanDialog({ plan: Plan; onDone: () => void })`; route `/app/plans`; nav item "Planos".

- [ ] **Step 1: Failing `PlanForm` test**

```tsx
// src/plan/PlanForm.test.tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { PlanForm } from "./PlanForm";

function renderForm(onCreated = vi.fn()) {
  storeApiKey("gk_test_abc");
  renderWithProviders([{ path: "/", element: <PlanForm onCreated={onCreated} onCancel={() => {}} /> }]);
  return onCreated;
}

describe("PlanForm", () => {
  it("sendsCentsAndRefusesEmptyNameAndZeroCount", async () => {
    const bodies: unknown[] = [];
    const keys: (string | null)[] = [];
    server.use(
      http.post("http://localhost:8080/v1/plans", async ({ request }) => {
        bodies.push(await request.json());
        keys.push(request.headers.get("Idempotency-Key"));
        return HttpResponse.json({ id: "pl_1", name: "Mensal", amount: 4990, currency: "BRL", interval: "MONTH", interval_count: 1, trial_days: 0, active: true, created_at: "2026-10-08T10:00:00Z" }, { status: 201 });
      }),
    );
    const onCreated = renderForm();

    await userEvent.type(screen.getByLabelText("Valor"), "49,90");
    await userEvent.clear(screen.getByLabelText("A cada"));
    await userEvent.type(screen.getByLabelText("A cada"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));

    expect(await screen.findByText("Informe o nome.")).toBeInTheDocument();
    expect(screen.getByText("Pelo menos 1.")).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    await userEvent.type(screen.getByLabelText("Nome"), "Mensal");
    await userEvent.clear(screen.getByLabelText("A cada"));
    await userEvent.type(screen.getByLabelText("A cada"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(bodies[0]).toEqual({ name: "Mensal", amount: 4990, currency: "BRL", interval: "MONTH", interval_count: 1, trial_days: 0 });
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("aGatewayErrorIsShownAndTheKeyIsKept", async () => {
    const keys: (string | null)[] = [];
    let calls = 0;
    server.use(
      http.post("http://localhost:8080/v1/plans", ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ type: "urn:gateway:INVALID_REQUEST", status: 400, detail: "x" }, { status: 400 })
          : HttpResponse.json({ id: "pl_1", name: "A", amount: 100, currency: "BRL", interval: "DAY", interval_count: 1, trial_days: 0, active: true, created_at: "2026-10-08T10:00:00Z" }, { status: 201 });
      }),
    );
    renderForm();

    await userEvent.type(screen.getByLabelText("Nome"), "A");
    await userEvent.type(screen.getByLabelText("Valor"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Requisição inválida.");

    await userEvent.click(screen.getByRole("button", { name: "Criar plano" }));
    await vi.waitFor(() => expect(calls).toBe(2));
    // Same intent, same key: a retry after a failure must replay, not duplicate.
    expect(keys[1]).toBe(keys[0]);
  });
});
```

- [ ] **Step 2: Run, see it fail; write `PlanForm`**

```tsx
// src/plan/PlanForm.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { TextField } from "../customer/TextField";
import { MoneyInput } from "../order/MoneyInput";
import { messageFor } from "../support/gatewayError";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { Button } from "../support/ui/Button";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { createPlan, planKeys } from "./planApi";
import type { Plan, PlanInterval } from "./types";

type Props = { onCreated: (plan: Plan) => void; onCancel: () => void };

const INTERVALS: { value: PlanInterval; label: string }[] = [
  { value: "DAY", label: "dia(s)" },
  { value: "WEEK", label: "semana(s)" },
  { value: "MONTH", label: "mês(es)" },
  { value: "YEAR", label: "ano(s)" },
];

type Errors = { name?: string; amount?: string; count?: string; trial?: string };

// A dialog, not a page: a plan has five fields and the list is where the merchant came from.
export function PlanForm({ onCreated, onCancel }: Props) {
  const queryClient = useQueryClient();
  const idempotencyKey = useIdempotencyKey();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [interval, setInterval] = useState<PlanInterval>("MONTH");
  const [count, setCount] = useState("1");
  const [trial, setTrial] = useState("0");
  const [errors, setErrors] = useState<Errors>({});

  const create = useMutation({
    mutationFn: (body: Parameters<typeof createPlan>[0]) => createPlan(body, idempotencyKey.current()),
    onSuccess: (plan) => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all });
      idempotencyKey.renew();
      onCreated(plan);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const countNumber = Number(count);
    const trialNumber = Number(trial);
    const next: Errors = {};
    if (name.trim() === "") {
      next.name = "Informe o nome.";
    }
    if (amount === null) {
      next.amount = "Informe o valor.";
    }
    if (!Number.isInteger(countNumber) || countNumber < 1) {
      next.count = "Pelo menos 1.";
    }
    if (!Number.isInteger(trialNumber) || trialNumber < 0) {
      next.trial = "Zero ou mais dias.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || amount === null) {
      return;
    }

    create.mutate({ name: name.trim(), amount, currency: "BRL", interval, interval_count: countNumber, trial_days: trialNumber });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Novo plano"
        className="w-full max-w-md space-y-4 rounded-card border border-line bg-surface p-5 text-ink shadow-xl"
      >
        <h2 className="font-display text-lg font-semibold">Novo plano</h2>
        <TextField label="Nome" id="plan-name" value={name} error={errors.name} onChange={(event) => setName(event.target.value)} />
        <MoneyInput valueCents={amount} onChange={setAmount} />
        {errors.amount && <p className="text-sm text-danger">{errors.amount}</p>}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="A cada" id="plan-count" type="number" min={1} value={count} error={errors.count} onChange={(event) => setCount(event.target.value)} />
          <Field label="Intervalo" htmlFor="plan-interval">
            <select id="plan-interval" value={interval} className={INPUT_CLASSES} onChange={(event) => setInterval(event.target.value as PlanInterval)}>
              {INTERVALS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <TextField label="Dias de trial" id="plan-trial" type="number" min={0} value={trial} error={errors.trial} onChange={(event) => setTrial(event.target.value)} />
        <p className="text-xs text-muted">Valor e intervalo não mudam depois: para outro preço, crie outro plano.</p>
        {create.isError && (
          <p role="alert" className="text-sm text-danger">{messageFor(create.error)}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Voltar</Button>
          <Button type="submit" disabled={create.isPending}>Criar plano</Button>
        </div>
      </form>
    </div>
  );
}
```

Note: `MoneyInput` hardcodes `id="amount"` and label "Valor"; one money input per screen is fine here because the dialog is the only one mounted. Run: `pnpm vitest run src/plan/PlanForm.test.tsx` → PASS.

- [ ] **Step 3: Failing `PlansPage` test**

```tsx
// src/plan/PlansPage.test.tsx
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { storeApiKey } from "../auth/apiKey";
import { server } from "../test/msw/server";
import { renderWithProviders } from "../test/render";
import { PlansPage } from "./PlansPage";

const monthly = { id: "pl_1", name: "Mensal", amount: 4990, currency: "BRL", interval: "MONTH", interval_count: 1, trial_days: 7, active: true, created_at: "2026-10-01T12:00:00Z" };
const old = { ...monthly, id: "pl_2", name: "Antigo", active: false, trial_days: 0 };

function renderPage() {
  storeApiKey("gk_test_abc");
  return renderWithProviders([{ path: "/app/plans", element: <PlansPage /> }], { initialEntries: ["/app/plans"] });
}

describe("PlansPage", () => {
  it("listsPlansWithLabelsAndFiltersActiveOnes", async () => {
    const urls: string[] = [];
    server.use(
      http.get("http://localhost:8080/v1/plans", ({ request }) => {
        urls.push(new URL(request.url).search);
        return HttpResponse.json(request.url.includes("active=true") ? [monthly] : [monthly, old]);
      }),
    );
    renderPage();

    const rows = await screen.findAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText("R$ 49,90 / mês")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("7 dias")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Inativo")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Só ativos"));
    await vi.waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
    expect(urls).toContain("?active=true");
  });

  it("editsNameAndActiveOnly", async () => {
    let patched: unknown = null;
    server.use(
      http.get("http://localhost:8080/v1/plans", () => HttpResponse.json([monthly])),
      http.patch("http://localhost:8080/v1/plans/pl_1", async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...monthly, name: "Mensal Plus", active: false });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Editar Mensal" }));
    const dialog = screen.getByRole("dialog", { name: "Editar plano" });
    expect(within(dialog).queryByLabelText("Valor")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/não cancela assinaturas/)).toBeInTheDocument();

    const name = within(dialog).getByLabelText("Nome");
    await userEvent.clear(name);
    await userEvent.type(name, "Mensal Plus");
    await userEvent.click(within(dialog).getByLabelText("Ativo"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(patched).toEqual({ name: "Mensal Plus", active: false }));
  });

  it("opensTheCreateDialog", async () => {
    server.use(http.get("http://localhost:8080/v1/plans", () => HttpResponse.json([])));
    renderPage();

    expect(await screen.findByText("Nenhum plano por aqui.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Novo plano/ }));
    expect(screen.getByRole("dialog", { name: "Novo plano" })).toBeInTheDocument();
  });
});
```

Add `import { vi } from "vitest"` to the imports (merge into the existing `vitest` import).

- [ ] **Step 4: Run, see it fail; write `EditPlanDialog` and `PlansPage`**

```tsx
// src/plan/EditPlanDialog.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { TextField } from "../customer/TextField";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { patchPlan, planKeys } from "./planApi";
import type { Plan } from "./types";

type Props = { plan: Plan; onDone: () => void };

// Only name and active: the gateway refuses the rest (PLAN_IMMUTABLE) and the form never offers it.
export function EditPlanDialog({ plan, onDone }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(plan.name);
  const [active, setActive] = useState(plan.active);
  const [nameError, setNameError] = useState<string | undefined>();

  const save = useMutation({
    mutationFn: () => patchPlan(plan.id, { name: name.trim(), active }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all });
      onDone();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() === "") {
      setNameError("Informe o nome.");
      return;
    }
    setNameError(undefined);
    save.mutate();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Editar plano"
        className="w-full max-w-md space-y-4 rounded-card border border-line bg-surface p-5 text-ink shadow-xl"
      >
        <h2 className="font-display text-lg font-semibold">Editar plano</h2>
        <TextField label="Nome" id="edit-plan-name" value={name} error={nameError} onChange={(event) => setName(event.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Ativo
        </label>
        <p className="text-xs text-muted">
          Desativar esconde o plano de novas assinaturas e não cancela assinaturas existentes. Valor e
          intervalo não mudam: para outro preço, crie outro plano.
        </p>
        {save.isError && (
          <p role="alert" className="text-sm text-danger">{messageFor(save.error)}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>Voltar</Button>
          <Button type="submit" disabled={save.isPending}>Salvar</Button>
        </div>
      </form>
    </div>
  );
}
```

```tsx
// src/plan/PlansPage.tsx
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatDateTime } from "../support/dates";
import { messageFor } from "../support/gatewayError";
import { Badge } from "../support/ui/Badge";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { PageHeader } from "../support/ui/PageHeader";
import { Table } from "../support/ui/Table";
import { EditPlanDialog } from "./EditPlanDialog";
import { listPlans, planKeys } from "./planApi";
import { PlanForm } from "./PlanForm";
import { priceLabel, trialLabel } from "./planLabels";
import type { Plan } from "./types";

const HEADERS = ["Nome", "Preço", "Trial", "Status", "Criado em", ""];

export function PlansPage() {
  const [activeOnly, setActiveOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const active = activeOnly ? true : undefined;
  const plans = useQuery({ queryKey: planKeys.list(active), queryFn: () => listPlans(active) });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Planos"
        action={
          <Button onClick={() => setCreating(true)}>
            <span aria-hidden="true">+</span>Novo plano
          </Button>
        }
      />

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />
        Só ativos
      </label>

      {plans.isError && (
        <p role="alert" className="text-danger">{messageFor(plans.error)}</p>
      )}

      <Card className="p-0 sm:p-2">
        <Table headers={HEADERS}>
          {(plans.data ?? []).map((plan) => (
            <tr key={plan.id} className="hover:bg-surface-muted">
              <td className="font-medium">{plan.name}</td>
              <td className="whitespace-nowrap">{priceLabel(plan)}</td>
              <td className="whitespace-nowrap text-muted">{trialLabel(plan.trial_days)}</td>
              <td>
                <Badge tone={plan.active ? "ok" : "neutral"}>{plan.active ? "Ativo" : "Inativo"}</Badge>
              </td>
              <td className="whitespace-nowrap text-muted">{formatDateTime(plan.created_at)}</td>
              <td className="text-right">
                <Button variant="ghost" size="sm" aria-label={`Editar ${plan.name}`} onClick={() => setEditing(plan)}>
                  Editar
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {plans.isSuccess && plans.data.length === 0 && (
        <p className="text-center text-muted">Nenhum plano por aqui.</p>
      )}

      {creating && <PlanForm onCreated={() => setCreating(false)} onCancel={() => setCreating(false)} />}
      {editing && <EditPlanDialog plan={editing} onDone={() => setEditing(null)} />}
    </section>
  );
}
```

Check `buttonClasses.ts` for the `size` values; if `"sm"` does not exist, use the existing small size or omit `size`. Run: `pnpm vitest run src/plan` → PASS.

- [ ] **Step 5: Route and nav item, layout test extended**

In `src/app/AppLayout.test.tsx` add next to the Configurações assertion:

```tsx
    expect(within(nav).getByRole("link", { name: "Planos" })).toHaveAttribute("href", "/app/plans");
```

Then in `src/app/AppLayout.tsx` the nav becomes, in this order: Cobranças, Clientes, Planos, Configurações (Assinaturas is added by part 3, between Clientes and Planos):

```tsx
            <NavLink to="/app/plans" className={navClass}>
              Planos
            </NavLink>
```

In `src/app/router.tsx`, import `PlansPage` and add `{ path: "plans", element: <PlansPage /> }` before `settings`.

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plan src/app
git commit -m "feat(plans): list, create and edit plans from the panel"
```

---

### Task 7: README and the plan's own close

**Files:**
- Modify: `README.md` (table "Telas")

- [ ] **Step 1: Add the rows**

In the `## Telas` table of `README.md`, after the `/app/customers/new` row:

```markdown
| `/app/plans` | planos: lista com filtro "só ativos", novo plano e edição de nome/ativo |
| `/app/settings` | configurações: conta (loja, ambiente, prefixo da chave) e parcelamento (máximo, sem juros até, juros ao mês, prévia do que o pagador vê) |
```

And in the API line below the table, append: `GET/PUT /v1/installment-settings`, `GET/POST /v1/plans`, `PATCH /v1/plans/{id}`.

- [ ] **Step 2: Full verification and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green.

```bash
git add README.md
git commit -m "docs(readme): plans and settings screens"
```

---

## Self-review notes

- Spec coverage: §1 frame (Task 1), nav items (Tasks 4 and 6; Assinaturas waits for part 3), §5 login (Task 2), §5 settings (Tasks 3–4), §3 plans (Tasks 5–6), §6 errors (`messageFor` in every form; `INVALID_REQUEST` is already in the table) and tests (each task), §7 rows 1–3. `/app/customers/new` → panel is part 2 (it belongs with the customers workspace).
- Types: `InstallmentSettingsInput` is the shape both the API and the preview take; `Plan`/`NewPlan`/`PlanPatch` are the only plan shapes; `Workspace` props are `selected`/`left`/`children` everywhere.
- Review Focus 1–5 each have a named test in Tasks 3, 3, 4, 6, 1.
