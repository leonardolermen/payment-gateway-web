# Painel do merchant e checkout do pagador — design

Data: 2026-10-06. Front do `payment-gateway`, repositório próprio. Decisões do usuário (2026-10-06):
escopo de merchant, usado por ele mesmo por agora; o pagador final paga por link sem login; repositório
separado do gateway; React + TypeScript + Vite. Depende do plano **checkout público** do gateway
(`payment-gateway/docs/superpowers/specs/2026-10-06-checkout-publico-design.md`): rotas
`/v1/checkout/{token}` e CORS por lista. Fora da v1: planos, assinaturas, contestações, entregas de
webhook, operador, login por operador (Plano H do gateway).

## 1. Stack e estrutura
Vite 6, React 19, TypeScript estrito, React Router 7, TanStack Query 5, Tailwind 4, Vitest + Testing
Library + MSW, ESLint + Prettier, Node 22, pnpm. Deploy no Vercel (preview por branch, `vercel.json`
com CSP). Um bundle, duas árvores de rota:

```
src/
  app/            roteador, providers, layout do painel
  auth/           login, guarda de rota, armazenamento da chave
  order/          lista, nova cobrança, detalhe, ações (cancelar, reembolsar)
  customer/       lista, cadastro
  checkout/       tela do pagador: carregamento por token, escolha de método, pix, boleto, cartão, pago
  support/        cliente HTTP, erros do gateway → texto, dinheiro (centavos ↔ reais), datas
```

Pasta tem nome de conceito; `support/` só para o que todos usam. Identificadores em inglês; textos de
tela em português; comentário explica porquê. Um componente por arquivo; arquivo passando de ~200
linhas se divide. Nenhum `any`.

## 2. Autenticação do painel
`auth/apiKey.ts`: a chave vive no `sessionStorage` (`gateway.apiKey`) e some ao fechar a aba.
`/app/login` recebe a chave e valida com `GET /v1/merchant`; falha mostra "chave inválida" sem
detalhar. `RequireApiKey` envolve `/app/*`. O cliente HTTP (`support/http.ts`) injeta `X-Api-Key` só
em chamadas do painel; um 401 limpa a chave e redireciona para o login com `?next=`. A chave nunca vai
para URL, log, estado global serializável ou para as rotas `/v1/checkout`.

`VITE_API_URL` é a base da API (dev: `http://localhost:8080`; preview e prod: valores do Vercel).

## 3. Telas do painel

| rota | conteúdo |
|---|---|
| `/app/orders` | tabela: criado em, cliente ou pagador, descrição, valor, status, método da tentativa ativa; filtro por status; cursor `X-Next-Cursor` como "carregar mais"; `refetchInterval` 10 s com a aba visível |
| `/app/orders/new` | valor (máscara R$, enviado em centavos), descrição, referência, vencimento (datetime, enviado em ISO), cliente: busca por nome/documento em `/v1/customers` ou "novo cliente" inline (nome, documento, e-mail); `Idempotency-Key` = UUID gerado ao abrir o formulário e mantido até o sucesso, para o duplo clique e o retry não criarem duas ordens; sucesso → detalhe |
| `/app/orders/:id` | resumo; `checkout_url` com botão copiar e aviso quando nulo (ordem anterior ao token) e botão "gerar novo link" (`rotate`); tentativas (`GET /v1/orders/{id}/payments`) com método, status, valor, criado em; ações: **cancelar** (`POST /v1/orders/{id}/cancel`, confirmação) e **reembolsar** a tentativa `COMPLETED` (`POST /v1/payments/{id}/refunds`, valor total ou parcial, confirmação); polling 5 s enquanto há tentativa `PENDING` |
| `/app/customers` | lista com nome, documento mascarado (`***.456.789-**`), e-mail, criado em; cursor |
| `/app/customers/new` | nome, documento, e-mail, endereço opcional; erro de validação do gateway mostrado no campo que ele nomeia (`customer.document` → campo documento) |

## 4. Tela do pagador (`/pay/:token`)
Máquina de estados em `checkout/checkoutState.ts`, testada sem DOM:

```
loading → unavailable (404, 410, status CANCELED|EXPIRED)
        → paid        (status PAID)
        → choosing    (OPEN, sem active_payment)
        → pix | boleto | card   (escolha, ou active_payment já existente do mesmo método)
pix     → paid (polling 3 s em GET .../payments/{id} até COMPLETED) | expired (tentativa EXPIRED → choosing)
card    → paid | declined (FAILED: mensagem do gateway e botão tentar de novo → choosing)
boleto  → (fica: mostra linha digitável e PDF; polling 30 s)
```

- `choosing` mostra só os `methods` da resposta. "Trocar de método" com Pix ou boleto vivo chama
  `POST .../payments/{id}/cancel` antes.
- **Pix**: `POST .../payments {"method":"PIX"}`; QR renderizado no cliente (`qrcode` lib) a partir do
  `copy_paste`; botão copiar; contagem regressiva até `expires_at`.
- **Boleto**: `{"method":"BOLECODE"}`; linha digitável, copiar, link do PDF, vencimento.
- **Cartão**: número (Luhn no cliente, bandeira só para o ícone), nome, validade, CVV, parcelas (1 a
  12, a API decide o máximo); `{"method":"CARD","card":{...},"installments":n}`. Os campos ficam no
  estado do formulário e são zerados após a resposta; nunca entram em log, URL, `localStorage` ou
  no estado da máquina (ela guarda só `payment.id`). `autocomplete="cc-number"` etc.
- `paid`: valor, data, "você pode fechar esta página". Recarregar sempre refaz `GET /v1/checkout/{token}`.

## 5. Erros
`support/gatewayError.ts`: `{code, message}` → texto. Tabela de códigos conhecidos (`ORDER_CLOSED`,
`ORDER_HAS_ACTIVE_PAYMENT`, `CARD_DECLINED`, `VALIDATION`…) com texto em português; código
desconhecido mostra o `message` do gateway. Erro de rede: "não foi possível falar com o servidor" com
botão tentar de novo. Erro de validação com campo (`field`) vai para o campo no formulário.

## 6. Testes e CI
- Vitest: `checkoutState` (todas as transições), máscara de dinheiro (centavos ↔ reais, arredondamento),
  `gatewayError`, `apiKey` (guarda, limpa no 401), Luhn.
- Testing Library + MSW: login inválido e válido; lista de ordens com cursor; nova cobrança envia
  centavos e `Idempotency-Key` estável entre dois cliques; detalhe copia o link; tela do pagador em cada
  estado, incluindo o cartão sendo zerado após a resposta.
- `cardDataNeverPersists.test.ts`: varre `localStorage`/`sessionStorage` e o cache do TanStack Query
  após um pagamento com cartão: nenhum número, validade ou CVV.
- Playwright de fumaça (opcional, `pnpm e2e`): contra o gateway local com WireMock do Itaú — cria
  cobrança, abre o link, paga por Pix, vê "pago" e a ordem `PAID` no painel. Fora do CI por default.
- GitHub Actions: `pnpm install --frozen-lockfile`, `tsc --noEmit`, `eslint`, `vitest run`, `vite build`.

## 7. Segurança do navegador
`vercel.json`: `Content-Security-Policy: default-src 'self'; connect-src 'self' <VITE_API_URL>;
img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'`,
`Referrer-Policy: no-referrer` (o token do checkout está na URL e não pode vazar no `Referer`),
`X-Content-Type-Options: nosniff`. Nenhum script de terceiro. O token do checkout nunca é logado.

## 8. Decisões
1. **Repositório separado, CORS.** Rejeitado: estático servido pelo Spring. Custo: lista de origens por
   ambiente e a chave do merchant num domínio diferente da API.
2. **Chave em `sessionStorage`, não `localStorage`.** Custo: cola de novo a cada aba nova. É o
   comportamento certo até o Plano H dar chaves de escopo reduzido.
3. **Máquina de estados do checkout fora do React.** Custo: um arquivo a mais. Ganha-se testar cada
   transição sem DOM e manter os dados do cartão fora dela.
4. **Cartão direto para o gateway.** Rejeitado: tokenização no front (não há provider de tokenização
   hoje). Custo: a página de checkout está no escopo PCI, como o gateway já está.
