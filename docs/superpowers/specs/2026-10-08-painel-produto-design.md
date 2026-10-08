# Painel como produto: clientes, assinaturas, planos, configurações — design

Data: 2026-10-08. Front do `payment-gateway`. Assume a spec de 2026-10-06 (painel e checkout) e a de
2026-10-07 (checkout e recorrência) em `main`. Decisões do usuário (2026-10-08): o painel vira produto
que um lojista usa no dia a dia; clientes completos (detalhe, editar, excluir, cartões salvos);
assinaturas completas, com criação por Pix, boleto **e cartão**; "taxas" = juros de parcelamento;
**login com e-mail e senha é o alvo, mas fica para o próximo projeto do gateway** — esta spec mantém
o login por chave de API, polido. Fora: webhooks (endpoints e entregas), contestações, taxa do gateway
por transação, redesign visual (o kit e os temas de 2026-10-06 ficam).

## 0. O que depende do gateway
O front assume quatro coisas que o gateway ainda não tem. Cada entrega da §7 diz de qual depende.

| gateway | onde cai no front |
|---|---|
| `GET /v1/subscriptions?status&limit&cursor` geral (hoje só `?customer_id=`) | lista de assinaturas |
| `GET /v1/orders?customer_id=` | histórico do cliente |
| `GET /v1/customers?q=` por nome (hoje só `?document=` exato) | busca na lista de clientes |
| spec `payment-gateway/docs/superpowers/specs/2026-10-07-assinatura-por-link-design.md`: assinatura `CARD` sem `card_id` nasce `INCOMPLETE`, resposta traz `first_invoice.checkout_url`; `INCOMPLETE_EXPIRED` | nova assinatura de cartão pelo link |

As três listagens seguem o padrão de `GET /v1/orders` (cursor = id do último item, filtro pelo
ambiente da chave) e cabem numa PR pequena do gateway.

## 1. Estrutura e navegação
A barra de cima ganha cinco itens: **Cobranças · Clientes · Assinaturas · Planos · Configurações**.
À direita, como hoje: selo TEST/LIVE, tema, "Sair". Sem sidebar: o layout de 2026-10-06
(`max-w-6xl`, header de 56 px) é o mockup aprovado e não é o que está sendo mudado.

Duas formas de tela, reusadas em tudo:
- **Workspace** — lista à esquerda, detalhe ou formulário à direita, rota filha escolhe o painel. É
  o que `OrdersWorkspace` faz hoje; a moldura sai dele para `support/ui/Workspace` e Clientes e
  Assinaturas a reusam. `OrdersWorkspace` passa a usá-la sem mudar de comportamento.
- **Página simples** — Planos (tabela + dialog) e Configurações (abas).

```
src/
  app/            layout, router
  auth/           login (polido), chave, merchant
  order/          como hoje
  customer/       CustomersWorkspace, CustomersList, CustomerDetailPanel, NewCustomerPanel,
                  EditCustomerForm, SavedCards, DeleteCustomerDialog, customerApi, types
  subscription/   SubscriptionsWorkspace, SubscriptionsList, SubscriptionDetailPanel,
                  NewSubscriptionForm, InvoicesTable, DunningTable, CancelSubscriptionDialog,
                  ChangeMethodDialog, subscriptionApi, types
  plan/           PlansPage, PlanForm, planLabels, planApi, types
  settings/       SettingsPage, AccountSection, InstallmentSettingsForm, installmentPreview,
                  installmentApi, types
  checkout/       como hoje
  support/        http, gatewayError, money, dates, ui/ (+ Workspace, Tabs, ConfirmDialog)
```

Rotas novas: `/app/customers/:id`, `/app/subscriptions`, `/app/subscriptions/:id`, `/app/plans`,
`/app/settings`. `/app/customers/new` deixa de ser página: o formulário vira painel do workspace e a
rota antiga redireciona para `/app/customers`, como `orders/new` já faz.

## 2. Clientes
**Lista** (`/app/customers`): um campo de busca; só dígitos → `?document=`, senão → `?q=`. Colunas
nome · documento mascarado · e-mail · criado em; "carregar mais" por cursor. "Novo cliente" abre
`NewCustomerPanel` à direita (mesmos campos e validação por campo do `NewCustomerPage` atual).

**Detalhe** (`/app/customers/:id`), três blocos:
- *Dados* — nome, documento, e-mail, endereço. "Editar" troca o bloco pelo `EditCustomerForm`
  (`PATCH /v1/customers/{id}`). O documento aparece e não se edita: é selado no gateway.
- *Cartões salvos* — `GET /v1/customers/{id}/cards`: bandeira, final, validade, titular. "Remover"
  com confirmação → `DELETE /v1/cards/{id}`. Cartão preso a uma assinatura ativa é o gateway quem
  recusa; o erro aparece na linha do cartão. O front não adivinha antes.
- *Histórico* — pedidos (`GET /v1/orders?customer_id=`) e assinaturas
  (`GET /v1/subscriptions?customer_id=`); cada linha leva à tela correspondente.

**Excluir** — botão discreto no rodapé; o dialog exige digitar o nome do cliente
(`DELETE /v1/customers/{id}` é LGPD e irreversível). Sucesso volta à lista. Assinatura ativa faz o
gateway recusar e o dialog mostra qual.

**Nova cobrança daqui** — atalho que abre `/app/orders?customer_id=…`; o `NewOrderForm` lê o
parâmetro e já escolhe o cliente. Só isso vai na URL.

## 3. Planos
`/app/plans`: tabela nome · valor e intervalo (`R$ 49,90 / mês`, `R$ 120,00 a cada 3 meses`) · trial ·
ativo · criado em; filtro "só ativos" (`?active=true`). "Novo plano" em dialog: nome, valor (máscara
R$, enviado em centavos), intervalo (`DAY|WEEK|MONTH|YEAR`) e quantidade, dias de trial.
Editar oferece só nome e ativo (`PATCH`); o formulário diz "para mudar valor ou intervalo, crie outro
plano", e `PLAN_IMMUTABLE` nunca deveria chegar à tela. Desativar não cancela assinaturas, e o
dialog diz isso. `planLabels.ts` monta o rótulo de intervalo e tem teste de tabela.

## 4. Assinaturas
**Lista** (`/app/subscriptions`): cliente · plano · método · status · próxima cobrança; filtro por
status (`ACTIVE`, `PAST_DUE`, `INCOMPLETE`, `CANCELED`, `ENDED`; `INCOMPLETE_EXPIRED` só aparece
dentro de "encerradas"). Badge com a escala dos pedidos: `ACTIVE` ok, `PAST_DUE` warn, `INCOMPLETE`
neutro, `CANCELED`/`ENDED`/`INCOMPLETE_EXPIRED` apagado. `SubscriptionResponse` traz só `customer_id` e
`plan_id`: a lista resolve os nomes com `GET /v1/customers/{id}` e `GET /v1/plans/{id}` cacheados
pelo TanStack Query (planos são poucos; clientes repetem entre páginas). Se a listagem nova do gateway
vier com `customer_name` como a de pedidos, a consulta extra some.

**Nova assinatura** (painel direito): cliente (`CustomerPicker` existente), plano (só ativos), método
Pix / boleto / cartão, data de início opcional. Com cartão: se o cliente tem cartão salvo, escolhe um
(`card_id`); senão, "o pagador cadastra o cartão pelo link" — envia sem `card_id`, a assinatura
nasce `INCOMPLETE` e a resposta traz `first_invoice.checkout_url`, mostrado uma vez com "copiar"
(mesma regra do pedido: `GET` não reexibe). `Idempotency-Key` gerada ao abrir o formulário e mantida
até o sucesso, como `NewOrderForm`.

**Detalhe** (`/app/subscriptions/:id`):
- cabeçalho — status, plano, cliente (link), método e cartão (bandeira/final), período atual, próxima
  cobrança, "cancela no fim do período" quando `cancel_at_period_end`;
- *Faturas* — `GET /{id}/orders`: nº, período, valor, status, link para `/app/orders/:id`. A fatura
  `OPEN` tem "copiar link" (rotaciona o token, DECISOES do gateway 2026-10-06) e, se o método é
  cartão com `card_id`, "cobrar de novo" (`POST /v1/orders/{id}/payments`);
- *Recobrança* — `dunning[]`: tentativa, agendada, rodou, resultado; aparece quando há alguma;
- ações — **trocar método/cartão** (`PATCH {method, card_id?}`), **cancelar** com "no fim do
  período" (default) ou "agora" e confirmação (`POST /{id}/cancel {at_period_end}`).

Polling de 10 s na lista e no detalhe com a aba visível, como os pedidos.

## 5. Configurações e login
`/app/settings`, duas abas (`support/ui/Tabs`):
- *Conta* — nome do merchant, ambiente da chave com uma linha de explicação ("esta chave é TEST;
  cobranças aqui não movem dinheiro"), prefixo da chave (`gk_test_ab12…`, nunca a chave inteira; o
  prefixo vem de `GET /v1/merchant` se existir, senão do que foi colado no login), lembrete de que
  chaves se criam e rotacionam pelo operador. Quando o login com senha chegar, a chave passa a
  morar aqui.
- *Parcelamento* — `GET/PUT /v1/installment-settings`: máximo de parcelas (1–12), sem juros até N,
  juros ao mês em `%` com duas casas. A API fala em bps (`299` = `2,99%`); a conversão vive em
  `settings/installmentApi.ts` num lugar só, com teste de ida e volta. Ao lado, **prévia**: para um
  valor de exemplo (R$ 1.000,00, editável), a tabela `Nx de R$ … (total R$ …)` que o pagador verá.
  `installmentPreview.ts` reproduz `InstallmentPricing` do gateway: sem juros → total = valor,
  parcela = valor / n truncada ao centavo; com juros → tabela Price, parcela arredondada **para
  cima** ao centavo, total = parcela × n; parcela abaixo de R$ 5,00 não é oferecida (1x sempre).
  O teste usa os mesmos números do `InstallmentPricingTest` do gateway; divergência é bug aqui.

**Login** (`/app/login`): mesma mecânica (chave → `GET /v1/merchant` → `sessionStorage`), com cara
de produto: marca, campo com "mostrar", texto dizendo de onde a chave vem, selo do ambiente assim
que valida. Sem "lembrar neste navegador": chave em `localStorage` é risco que não compensa até
existir senha. **Login com e-mail e senha é o próximo projeto do gateway; esta tela é o que existe
até lá.**

## 6. Erros e testes
`gatewayError` ganha os códigos novos com texto em português; os nomes exatos saem do gateway na
implementação, não desta spec. Erro com `field` cai no campo; sem campo, no topo do formulário.
Nenhuma mutação é otimista: espera a resposta e invalida as queries da entidade.

Vitest + Testing Library + MSW, como hoje. Por tela: lista renderiza e pagina; formulário envia o
payload certo (snake_case, centavos, bps) e mostra o erro do gateway no campo; ação destrutiva exige
confirmação. Funções puras com teste próprio: `%` ↔ bps, `installmentPreview`, `planLabels`, busca
nome-vs-documento. Sem e2e automatizado (decisão de 2026-10-06).

## 7. Ordem de entrega
Uma PR por linha. A fronteira é "depende do gateway ou não".

| # | entrega | gateway |
|---|---|---|
| 1 | `Workspace` extraído, cinco itens de navegação, rotas, login polido | — |
| 2 | Configurações: conta e parcelamento com prévia | — |
| 3 | Planos | — |
| 4 | Clientes: workspace, detalhe, editar, cartões, excluir, atalho de cobrança | `?customer_id=`, `?q=` |
| 5 | Assinaturas: lista, detalhe, cancelar, trocar método, nova com Pix/boleto/cartão salvo | listagem geral |
| 6 | Assinatura de cartão pelo link | spec assinatura por link |

## 8. Decisões
1. **Login continua por chave; senha é o próximo projeto do gateway.** Rejeitado: fazer o login com
   senha primeiro — travaria todas as telas atrás de um subsistema de usuários que não existe. Custo:
   por um tempo o produto tem uma tela de login que pede uma chave.
2. **Navegação na barra, sem sidebar.** Rejeitado: sidebar — é redesign, e o mockup de 2026-10-06
   foi aprovado. Custo: com mais de seis itens a barra aperta; aí sim a conversa é redesign.
3. **Prévia de parcelas calculada no front, copiando a fórmula do gateway.** Rejeitado: um endpoint
   de simulação — uma rota só para uma tela. Custo: duas cópias da fórmula; o teste com os mesmos
   números do gateway é o que as mantém iguais.
4. **O front não adivinha regras do gateway (cartão em uso, cliente com assinatura).** Tenta e mostra
   o erro. Rejeitado: desabilitar o botão com base em consultas extras. Custo: um clique que falha
   com mensagem clara, em vez de um botão cinza sem explicação.
5. **Três listagens novas no gateway em vez de montar no front.** Rejeitado: listar por cliente e
   juntar — não escala e nem é possível sem a lista de clientes inteira. Custo: uma PR no gateway
   antes das entregas 4 e 5.
