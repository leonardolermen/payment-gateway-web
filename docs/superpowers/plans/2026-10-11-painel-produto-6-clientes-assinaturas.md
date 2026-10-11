# Panel as a Product, part 6: Clientes e Assinaturas (F2 + F3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers become a real CRM screen (search, detail with data/cards/history, edit, delete with typed confirmation, "nova cobrança" shortcut) and subscriptions get their own screens (list with status filter, new subscription panel incl. card-by-link, detail with invoices, dunning, change method, cancel).

**Architecture:** Two concept folders, `src/customer/` (exists; grows) and `src/subscription/` (new), each with an API module on `merchantRequest`, TanStack Query keys, pages and small components. Subscriptions reuse the orders workspace pattern (`Workspace` with the list on the left and the detail/new panel on the right at `/app/subscriptions/:id`). Role gating through `can()`. Polling 10 s while visible, as orders.

**Tech Stack:** React 19, TypeScript strict, React Router 7, TanStack Query 5, Tailwind 4, Vitest + Testing Library + MSW 2.

**Spec:** `docs/superpowers/specs/2026-10-08-painel-produto-design.md` §2 (Clientes) and §4 (Assinaturas); `docs/superpowers/specs/2026-10-08-produto-completo-design.md` §4/§5 (only the parts B1 already enables: no notes/tags/import/MRR/pause yet). Gateway contract: `payment-gateway/README.md` "Customers, orders, plans and subscriptions" plus the B1b plan `payment-gateway/docs/superpowers/plans/2026-10-11-listagens-parte-2.md`. Branch base: `feat/painel-produto-5`.

## Global Constraints

- English code, pt-BR copy, no `any`, Prettier, `pnpm test && pnpm typecheck && pnpm lint` before each commit; commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Every request goes through `merchantRequest` (bearer + `X-Environment`); snake_case fields mirror the API.
- API (gateway; B1b routes marked †, mock them with MSW exactly as written):
  - `GET /v1/customers?limit=&cursor=`, `GET /v1/customers?document=` (0 or 1), †`GET /v1/customers?q=` (name contains), `GET /v1/customers/{id}`, `PATCH /v1/customers/{id} {name?, email?, address?}` (400 on empty/unknown field; `document` immutable), `DELETE /v1/customers/{id}` → 204 | 409 `CUSTOMER_HAS_ACTIVE_SUBSCRIPTION`, `GET /v1/customers/{id}/cards` → `[{id, brand, last4, expiry "MM/YYYY", holder, created_at}]`, `DELETE /v1/cards/{id}` → 204 | 409 (card in use by an active subscription; code from the gateway, show `detail`).
  - †`GET /v1/orders?customer_id=&limit=&cursor=`; existing `Order` has `customer_name`, `checkout_url`.
  - †`GET /v1/subscriptions?status=&customer_id=&limit=&cursor=` → `SubscriptionResponse[]`: `{id, status, customer_id, customer_name†, plan_id, method: "PIX"|"BOLECODE"|"CARD", card_id, current_period: {start, end}|null, next_billing_at, cancel_at_period_end, latest_order: Order|null, dunning: [{attempt, scheduled_at, ran_at, outcome}], created_at}`; `GET /v1/subscriptions/{id}`; `POST /v1/subscriptions {customer_id, plan_id, method, card_id?, start_at?}` with `Idempotency-Key` → 201 (`INCOMPLETE` with `latest_order.checkout_url` when CARD without `card_id`); 422 `PLAN_INACTIVE`, `CARD_REQUIRED`, `CARD_NOT_OWNED_BY_CUSTOMER`, `CUSTOMER_ADDRESS_REQUIRED`; `POST /v1/subscriptions/{id}/cancel {at_period_end}` → 200 | 409 `SUBSCRIPTION_NOT_ACTIVE`; `PATCH /v1/subscriptions/{id} {method, card_id?}`; `GET /v1/subscriptions/{id}/orders` → `Order[]` newest first.
  - Statuses: `ACTIVE`, `PAST_DUE`, `INCOMPLETE`, `INCOMPLETE_EXPIRED`, `CANCELED`, `ENDED`.
- Roles (`permissions.ts`, exists): `create_customer`/`create_subscription`/`create_charge` FINANCE; `delete_customer` OWNER; add `edit_customer: "OWNER"`, `cancel_subscription: "FINANCE"`, `change_subscription_method: "FINANCE"`, `delete_card: "OWNER"`. Buttons the role lacks do not render.
- Only ids go in URLs (`?customer_id=`), never names or documents. The document is shown as the API masks it and is never editable.
- Nothing in this plan requires the gateway at test time; MSW mocks the contract above.

## Review Focus

1. Typing a document with punctuation (`529.982.247-25`) in the customer search must query `?document=52998224725`, and a name with spaces must query `?q=` URL-encoded — Task 1 (`searchesByDocumentOrName`).
2. The delete dialog must stay disabled until the typed name equals the customer's name exactly (case-sensitive, trimmed) and must show the gateway's 409 detail without closing — Task 3 (`deleteNeedsTheExactNameAndShowsTheConflict`).
3. Removing a card that a subscription uses must show the error on that card's row and keep the list — Task 2 (`cardInUseShowsTheErrorOnItsRow`).
4. A CARD subscription without a saved card must send no `card_id`, show the checkout link once with "copiar", and the link must not be in the query cache after navigating away — Task 5 (`cardByLinkShowsTheLinkOnce`).
5. Cancel defaults to "no fim do período"; choosing "agora" and confirming sends `{at_period_end: false}`; `SUBSCRIPTION_NOT_ACTIVE` lands in the dialog — Task 6 (`cancelNowSendsAtPeriodEndFalse`).

---

### Task 1: Customers list — search, roles, link to detail

**Files:**
- Modify: `src/customer/customerApi.ts` (`listCustomers` gains `q`; `customerKeys.list(params)`, `customerKeys.detail(id)`, `customerKeys.cards(id)`), `src/customer/CustomersPage.tsx`, `src/customer/CustomersPage.test.tsx`
- Create: `src/customer/CustomerSearch.tsx`

**Interfaces:**
- Produces: `customerKeys = { all, list: (params: {q?: string; document?: string}) => [...], detail: (id) => ["customers", id], cards: (id) => ["customers", id, "cards"] }`; `listCustomers({cursor?, limit?, q?, document?})`.

- [ ] Tests first in `CustomersPage.test.tsx`: `searchesByDocumentOrName` (type `529.982.247-25` → request URL has `document=52998224725`; clear, type `Maria Souza` → `q=Maria+Souza`; debounce 300 ms with `vi.useFakeTimers` or `waitFor`), `rowsLinkToTheDetail` (row name is a `Link` to `/app/customers/{id}`), existing create-button role tests keep passing.
- [ ] `CustomerSearch`: one `<input aria-label="Buscar por nome ou documento">`; `onlyDigits(value).length >= 11 && /^[\d.\-/\s]+$/.test(value)` → document mode, else name mode; empty → plain list. Debounce 300 ms. `CustomersPage` uses `useInfiniteQuery` with `customerKeys.list({q, document})`; in document mode the API returns 0 or 1 (no pagination).
- [ ] `pnpm test && pnpm typecheck && pnpm lint`; commit `feat(customers): search by name or document; rows open the detail`.

---

### Task 2: Customer detail — data, saved cards, history

**Files:**
- Create: `src/customer/CustomerDetailPage.tsx`, `src/customer/CustomerDataCard.tsx`, `src/customer/SavedCardsCard.tsx`, `src/customer/CustomerHistoryCard.tsx`, `src/customer/cardApi.ts` (`listCards(customerId)`, `deleteCard(id)`), tests `CustomerDetailPage.test.tsx`, `SavedCardsCard.test.tsx`
- Modify: `src/customer/customerApi.ts` (`getCustomer`), `src/customer/types.ts` (`SavedCard`), `src/order/orderApi.ts` (`listOrders` accepts `customer_id`), `src/app/router.tsx` (`customers/:id`), `src/auth/permissions.ts` (`delete_card`, `edit_customer`)

**Interfaces:**
- Consumes: `customerKeys.detail/cards`, `orderKeys.list({customer_id})`, `subscriptionKeys.list({customer_id})` (define `subscriptionKeys` in `src/subscription/subscriptionApi.ts` in this task with `listSubscriptions(params)` and `Subscription` type — Task 4 builds on it).
- Produces: `SavedCardsCard({customerId})`, `CustomerHistoryCard({customerId})`.

- [ ] Tests: detail renders name/document/e-mail/address blocks; cards table with `brand · final · validade · titular`, "Remover" only for OWNER (`delete_card`), confirm → `DELETE /v1/cards/{id}` → row gone; `cardInUseShowsTheErrorOnItsRow` (409 → `role="alert"` inside that row, row stays); history lists orders (`GET /v1/orders?customer_id=`) and subscriptions (`GET /v1/subscriptions?customer_id=`) as links to `/app/orders/{id}` and `/app/subscriptions/{id}`; "Nova cobrança" link to `/app/orders?customer_id={id}` for FINANCE+, absent for READONLY.
- [ ] Implement; commit `feat(customers): detail with data, saved cards and history`.

---

### Task 3: Edit and delete a customer; "nova cobrança" preselect

**Files:**
- Create: `src/customer/EditCustomerForm.tsx`, `src/customer/DeleteCustomerDialog.tsx`, tests
- Modify: `src/customer/customerApi.ts` (`patchCustomer`, `deleteCustomer`), `src/customer/CustomerDataCard.tsx` ("Editar" for `edit_customer`), `src/customer/CustomerDetailPage.tsx` (footer "Excluir cliente" for `delete_customer`), `src/order/NewOrderForm.tsx` + `OrdersWorkspace.tsx` (read `?customer_id=` with `useSearchParams`, preselect through `CustomerPicker` value `{customer_id}`, then drop the param from the URL with `setSearchParams({}, {replace: true})`), `README.md`

- [ ] Tests: `EditCustomerForm` reuses `TextField` + field validation of `NewCustomerPage` (name required, e-mail format, zip digits), has no document input, sends only changed fields in the `PATCH`, 422/400 with `field` lands on the field; `deleteNeedsTheExactNameAndShowsTheConflict` (button disabled until the typed name matches; 409 `CUSTOMER_HAS_ACTIVE_SUBSCRIPTION` shows `detail` and keeps the dialog; 204 navigates to `/app/customers` and invalidates `customerKeys.all`); `NewOrderForm.test`: `?customer_id=cus_1` preselects and the URL loses the param.
- [ ] README: customers rows (`/app/customers/:id`), roles table (editar cliente: dono; remover cartão: dono). Commit `feat(customers): edit, delete with typed confirmation, new charge shortcut`.

---

### Task 4: Subscriptions list

**Files:**
- Create: `src/subscription/{types.ts, subscriptionApi.ts (extend from Task 2), subscriptionLabels.ts (status label + tone; method label reuse `order/methodLabels.ts`), SubscriptionStatusBadge.tsx, SubscriptionsList.tsx, SubscriptionsWorkspace.tsx, NoSubscriptionSelected.tsx}` + tests (`subscriptionLabels.test.ts`, `SubscriptionsList.test.tsx`)
- Modify: `src/app/router.tsx` (`subscriptions` workspace with `:id` and `new` children), `src/app/AppLayout.tsx` (nav item "Assinaturas" after Clientes), `AppLayout.test.tsx`

**Interfaces:**
- Produces: `subscriptionKeys = { all, list: (params) => [...], detail: (id) => [...], orders: (id) => [...] }`, `listSubscriptions({status?, customer_id?, cursor?, limit?})`, `getSubscription(id)`, `listSubscriptionOrders(id)`, `SUBSCRIPTION_STATUS: Record<SubscriptionStatus, {label: string; tone: BadgeTone}>`.

- [ ] Tests: columns cliente (`customer_name`, falls back to `customer_id`) · plano (name via `planKeys.detail` cached `GET /v1/plans/{id}`) · método · status badge · próxima cobrança (`formatDateTime(next_billing_at)` or "—"); filter `<select aria-label="Status">` with "Todas", `ACTIVE`, `PAST_DUE`, `INCOMPLETE`, `CANCELED`, `ENDED` → `?status=`; "encerradas" also shows `INCOMPLETE_EXPIRED` rows when the API returns them; rows link to `/app/subscriptions/{id}`; "carregar mais" by cursor; `refetchInterval` 10 s only when `document.visibilityState === "visible"` (copy the orders code). Tones: `ACTIVE` ok, `PAST_DUE` warn, `INCOMPLETE` neutral, others neutral with muted label.
- [ ] Commit `feat(subscriptions): list with status filter and the workspace`.

---

### Task 5: New subscription panel (incl. card by link)

**Files:**
- Create: `src/subscription/NewSubscriptionForm.tsx`, `src/subscription/SavedCardSelect.tsx`, `src/subscription/SubscriptionLinkPanel.tsx` (reuse `order/CheckoutLinkPanel` if its props fit; otherwise a thin wrapper), tests `NewSubscriptionForm.test.tsx`
- Modify: `src/subscription/subscriptionApi.ts` (`createSubscription(body, idempotencyKey)`), `src/support/gatewayError.ts` (messages for `PLAN_INACTIVE` "Este plano está inativo.", `CARD_REQUIRED` "Escolha um cartão ou envie o link para o pagador.", `CARD_NOT_OWNED_BY_CUSTOMER` "Este cartão não é deste cliente.", `CUSTOMER_ADDRESS_REQUIRED` "Boleto precisa do endereço do cliente."), `SubscriptionsWorkspace.tsx` ("Nova assinatura" for `create_subscription`, panel at `/app/subscriptions/new`)

- [ ] Tests: form has `CustomerPicker` (existing), plan `<select>` listing only active plans (`GET /v1/plans?active=true`), method radios Pix/boleto/cartão, optional start date (`<input type="date">` → `start_at` `YYYY-MM-DD`); with CARD and a customer that has saved cards (`GET /v1/customers/{id}/cards`) a `SavedCardSelect` appears with "o pagador cadastra pelo link" as the last option; `Idempotency-Key` from `useIdempotencyKey` is the same across a retry after a 5xx and different after success; `cardByLinkShowsTheLinkOnce` (201 with `latest_order.checkout_url` → panel shows the URL with "Copiar", and `queryClient.getQueryData(subscriptionKeys.detail(id))` has no `checkout_url` after the panel invalidates); 422 codes map to the messages above on the form alert; on success navigates to `/app/subscriptions/{id}` (non-link case).
- [ ] Commit `feat(subscriptions): new subscription — pix, boleto, saved card or card by link`.

---

### Task 6: Subscription detail — header, invoices, dunning, change method, cancel

**Files:**
- Create: `src/subscription/{SubscriptionDetailPanel.tsx, SubscriptionHeader.tsx, InvoicesTable.tsx, DunningTable.tsx, ChangeMethodDialog.tsx, CancelSubscriptionDialog.tsx}` + tests (`SubscriptionDetailPanel.test.tsx`, `CancelSubscriptionDialog.test.tsx`, `ChangeMethodDialog.test.tsx`)
- Modify: `src/subscription/subscriptionApi.ts` (`cancelSubscription(id, {at_period_end})`, `patchSubscription(id, {method, card_id?})`), `src/support/gatewayError.ts` (`SUBSCRIPTION_NOT_ACTIVE` "Esta assinatura não está ativa."), `README.md`

- [ ] Tests: header shows status badge, plan name, customer link to `/app/customers/{id}`, method and card (`brand · final` via `GET /v1/cards/{card_id}`), current period `formatDate(start) – formatDate(end)`, next billing, "Cancela no fim do período" when `cancel_at_period_end`; invoices from `GET /{id}/orders` with nº (`id` short), período, valor `formatBrl`, status `StatusBadge`, link to `/app/orders/{id}`; the `OPEN` invoice row has "Copiar link" (uses the existing rotate-link action from `OrderActions`/`orderApi`, gated by `rotate_checkout_link`) and, when method is CARD with `card_id`, "Cobrar de novo" → `POST /v1/orders/{id}/payments` (gated `create_charge`); dunning table only when `dunning.length > 0`; `cancelNowSendsAtPeriodEndFalse` (radio default "No fim do período"; "Agora" + confirm → body `{at_period_end: false}`; 409 shows the message in the dialog); change method dialog: radios + `SavedCardSelect` for CARD, `PATCH` body exact; polling 5 s while visible and status is `INCOMPLETE`/`PAST_DUE`, else 10 s (mirror `OrderDetailPanel.pollInterval`).
- [ ] README: `/app/subscriptions`, `/app/subscriptions/:id`, `/app/subscriptions/new` rows, API routes line, roles table rows (cancelar assinatura / trocar método: financeiro). Commit `feat(subscriptions): detail — invoices, dunning, change method, cancel`.

## Self-review notes
- Spec §2 fully in T1–T3 (search, detail blocks, edit, cards, history, delete with typed name, nova cobrança); §4 in T4–T6 (list, badges, names resolved, new incl. card-by-link with one-time link, detail with invoices/dunning/actions, polling). §3 Planos already done (F1).
- Interfaces consistent: `subscriptionKeys`, `listSubscriptions`, `SavedCard`, `SavedCardSelect`, `SUBSCRIPTION_STATUS` named once and reused.
- Out of scope (B7): notes/tags/import, MRR, pause/resume, plan change.
