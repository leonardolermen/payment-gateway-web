# Panel as a Product, part 5: Provedores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings › Provedores: an owner configures Itaú (Pix/boleto) and Cielo (card) credentials for the current environment, tests the connection, sets the Cielo notification key and copies the webhook URL to register at the bank.

**Architecture:** One concept folder `src/settings/providers/` with an API module on `merchantRequest`, a `ProvidersSection` listing one card per provider from the `GET`, a `CredentialForm` built from a per-provider field table (so a new provider is a table row, not a component), a PEM file reader that fills the textarea, and a `TestConnectionButton` that renders the fixed probe phrase. Secrets are write-only: the form shows "•••• definido" from `secrets_set` and sends only what the user typed (omitted = kept, as the gateway merges).

**Tech Stack:** React 19, TypeScript strict, TanStack Query 5, Tailwind 4, Vitest + Testing Library + MSW 2.

**Spec:** `docs/superpowers/specs/2026-10-08-produto-completo-design.md` §8 (Provedores) + gateway spec `payment-gateway/docs/superpowers/specs/2026-10-09-provedores-self-service-design.md`. Branch base: `feat/painel-produto-4` (F4 — `useCan`, `SettingsPage` tabs, `useEnvironment`).

## Global Constraints

- English code, pt-BR copy, no `any`, Prettier, `pnpm test && pnpm typecheck && pnpm lint` before each commit; `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Secrets:** never stored in React Query, `localStorage`, URL or logs; form state only, cleared after a successful `PUT`; the `GET` never contains them (the gateway guarantees it; the front must not keep what it typed after saving). A PEM file picked with `<input type="file">` is read with `FileReader.readAsText` into the field and nowhere else.
- API (gateway B4, snake_case, `X-Environment` from the header switch, owner session only):
  - `GET /v1/merchant/providers → {environment, inbound_webhook_url: string|null, providers: [{provider: "ITAU"|"CIELO", methods: string[], configured: boolean, updated_at: string|null, fingerprint: string|null, secrets_set: Record<string, boolean>, last_test: {ok, detail, checked_at}|null, notification_key_set: boolean|null}]}`
  - `PUT /v1/merchant/providers/{provider}/credentials {payload}` → 204; 422 `PROVIDER_CREDENTIALS_INVALID` + `field`; omitted secret = kept; `""` = removed.
  - `POST /v1/merchant/providers/{provider}/test` → `{ok, detail, checked_at}`; 404 `PROVIDER_CREDENTIALS_MISSING`.
  - `PUT /v1/merchant/providers/cielo/notification-key {key}` → 204.
  - Errors: 403 `FORBIDDEN_FOR_ROLE` for non-owners.
- Field table (the source of truth for the form, `providerFields.ts`):
  - ITAU: `client_id` (text), `client_secret` (secret), `pix_key` (text), `beneficiary_id` (text, boleto), `wallet_code` (text, default 109), `species_code` (text, default 01); LIVE only: `x_itau_apikey` (secret), `certificate_pem` (pem), `private_key_pem` (pem+secret).
  - CIELO: `merchant_id` (text), `merchant_key` (secret).
- Probe phrases come from the API verbatim (`detail`); the front adds only the icon/tone (ok → `ok`, else `danger`) and `checked_at` formatted.

## Review Focus

1. After a successful save the secret inputs must be empty and show "•••• definido", and the request body must contain only the fields the user typed (no empty strings unless the user cleared a secret explicitly via "Remover") — Task 2 (`CredentialForm.test: sendsOnlyWhatWasTypedAndForgetsSecretsAfterSaving`).
2. Switching the environment must re-render the section for the other environment (the `GET` is keyed by environment) and clear any unsaved form state — Task 2.
3. A 422 with `field` must land on that field; an unknown `field` lands on the form alert — Task 2.
4. Non-owners never see the tab (`can("providers")`) and a deep link falls back — Task 3.
5. "Testar conexão" must show the API's phrase, never a client-side guess, and update `last_test` in the card without a page reload — Task 2.

---

### Task 1: API module, types, field table

**Files:** `src/settings/providers/{providersApi.ts, types.ts, providerFields.ts, providerFields.test.ts, providersApi.test.ts}`

- `types.ts`: `ProviderId = "ITAU"|"CIELO"`, `ProviderStatus`, `ProvidersOverview`, `ProbeOutcome` mirroring the API; `FieldKind = "text"|"secret"|"pem"`, `FieldSpec = { name, label, kind, liveOnly?: boolean, hint?, defaultValue? }`.
- `providerFields.ts`: `PROVIDER_FIELDS: Record<ProviderId, FieldSpec[]>`, `providerTitle(id)` ("Pix e boleto · Itaú" / "Cartão · Cielo"), `fieldsFor(id, environment)` (filters `liveOnly`). Test: Itaú TEST has no `certificate_pem`; LIVE has; Cielo has two fields; every secret name matches the gateway's secret list.
- `providersApi.ts`: `providerKeys = { overview: (env) => ["providers", env] }`, `getProviders()`, `putCredentials(id, payload: Record<string,string>)`, `testConnection(id)`, `putNotificationKey(key)`. Test via MSW: routes and bodies.
- Commit `feat(providers): api, types and the field table`.

### Task 2: The section — cards, credential form, PEM picker, test button, notification key, webhook URL

**Files:** `src/settings/providers/{ProvidersSection.tsx, ProviderCard.tsx, CredentialForm.tsx, SecretField.tsx, PemField.tsx, TestConnectionButton.tsx, NotificationKeyForm.tsx, WebhookUrlCard.tsx}` + tests (`ProvidersSection.test.tsx`, `CredentialForm.test.tsx`, `PemField.test.tsx`, `TestConnectionButton.test.tsx`)

- `ProvidersSection`: `useQuery(providerKeys.overview(useEnvironment()))`; `WebhookUrlCard` (URL + copy via `copyToClipboard`, or "Webhook de entrada desligado neste gateway" when null); one `ProviderCard` per item.
- `ProviderCard`: title, methods as badges, status `Badge` ("Não configurado" neutral / "Conectado em {checked_at}" ok / "Falhou em {checked_at}" danger / "Configurado, não testado" warn), `updated_at`, the `CredentialForm`, `TestConnectionButton` (disabled until configured), and for CIELO the `NotificationKeyForm` ("definida"/"não definida").
- `CredentialForm`: fields from `fieldsFor(id, environment)`; `SecretField` shows a masked placeholder "•••• definido" when `secrets_set[name]`, a "Remover" ghost button that queues `""`, and never pre-fills; `PemField` = textarea + file input (`accept=".pem,.crt,.key"`) that reads the file into the textarea; submit sends `{payload}` with only touched fields (`""` only for removed secrets); on 204 → invalidate overview, clear secret/pem inputs, toast "Credenciais salvas"; 422 → field error by `field` or form alert. Form state resets on environment change (`key={environment}`).
- `TestConnectionButton`: `useMutation(testConnection)`; shows `detail` with tone; on success/failure invalidates overview so the card status updates.
- Tests: the Review Focus items 1, 2, 3, 5; PEM picker fills the textarea (jsdom `File` + `FileReader`); Cielo notification key sends `{key}`; webhook URL copy.
- Commit `feat(settings): providers — credentials per environment, connection test, notification key, webhook url`.

### Task 3: Tab + README

- `SettingsPage`: tab `Provedores` (`providers`) when `can(role, "providers")`, after Parcelamento; deep link fallback test for FINANCE; README rows (Provedores tab, what each role sees, the "omitted secret is kept" rule).
- Commit `feat(settings): the providers tab for owners`.

## Self-review notes
- Spec §8 Provedores covered by T2; owner-only by T3; API contract fixed by the gateway spec; secrets handling in Global Constraints + Focus 1.
- Interfaces: `providerKeys.overview(env)`, `fieldsFor`, `PROVIDER_FIELDS`, `ProbeOutcome` consistent across tasks.
