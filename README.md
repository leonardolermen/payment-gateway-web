# payment-gateway-web

Painel do merchant e checkout hospedado do payment gateway (React 19, Vite, Tailwind 4).

## Scripts

`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm test:watch`, `pnpm typecheck`, `pnpm lint`, `pnpm format`.

## Rodar contra um gateway local

1. **Gateway** (repositório `payment-gateway`). Variáveis de ambiente:
   - `GATEWAY_CORS_ORIGINS=http://localhost:5173`
   - `GATEWAY_CHECKOUT_BASE_URL=http://localhost:5173/pay/` (o link do checkout aponta para este app)
   - `WEBHOOK_MTLS_PORT=0` (só em desenvolvimento local)
2. **Merchant e chave de teste.** `scripts/dev_merchant.py` do gateway cria um merchant de
   desenvolvimento com uma chave TEST e grava `GATEWAY_DEV_API_KEY` no `.env` do gateway.
   Copie a chave de lá e cole na tela de login; ela não é guardada em nenhum arquivo deste repositório.
3. **Este app.** Copie `.env.example` para `.env` (`VITE_API_URL=http://localhost:8080`) e rode `pnpm dev`.
   O painel abre em `http://localhost:5173`.

## Telas

| Rota | O que é |
| --- | --- |
| `/app/login` | cola a chave do merchant e valida contra a API |
| `/app/orders` | lista de pedidos, filtro por status, paginação |
| `/app/orders/new` | novo pedido (escolhe ou cria o cliente na hora) |
| `/app/orders/:id` | detalhe, tentativas, link de checkout, ações e estorno |
| `/app/customers` | lista de clientes |
| `/app/customers/new` | novo cliente |
| `/pay/:token` | checkout do pagador: Pix, boleto ou cartão (sem chave, o token vem na URL) |

Rotas da API usadas nas listas: `GET /v1/orders?status&limit&cursor` e `GET /v1/customers?limit&cursor`.
O cursor é o id do último item da página anterior (não há `X-Next-Cursor`).
A chave vai no header `Authorization: Bearer`.

## Segurança

- A chave fica só em `sessionStorage` (morre com a aba). Qualquer 401 e o logout apagam a chave
  e o cache de consultas juntos.
- Os campos do cartão são zerados antes de qualquer envio e nunca vão para storage, cache nem URL
  (coberto por `src/checkout/cardDataNeverPersists.test.tsx`).
- `vercel.json` define CSP e `Referrer-Policy: no-referrer` (o token do checkout está na URL).
- O app não escreve logs.

## Deploy (Vercel)

`vercel.json` reescreve todo caminho para `index.html` (roteamento no cliente) e define os headers de segurança.

- `https://api.REPLACE-ME` no `Content-Security-Policy` é um placeholder: troque pelo host da API de
  cada ambiente, senão o navegador bloqueia toda chamada à API.
- Defina `VITE_API_URL` no ambiente do build, e `GATEWAY_CORS_ORIGINS` / `GATEWAY_CHECKOUT_BASE_URL`
  no gateway com o domínio do deploy.

## CI

typecheck, lint, test e build, com pnpm 9 e Node 22 (`.github/workflows/ci.yml`).

## Teste de fumaça manual (Pix)

Não há suíte e2e automatizada: depende de um gateway com provedor simulado, que o CI não tem.
Roteiro, com o gateway na 8080 e `pnpm dev` na 5173:

1. Login em `/app/login` com a chave de teste.
2. `/app/customers/new`: crie um cliente.
3. `/app/orders/new`: crie um pedido para ele e abra o detalhe.
4. Gere o link de checkout e abra `/pay/:token` em outra aba.
5. Escolha Pix: o QR code e o copia-e-cola aparecem.
6. Simule o pagamento no provedor de teste: o checkout vira "pago" e o detalhe do pedido mostra o status pago.
7. Logout: a chave some e `/app/orders` volta ao login.
