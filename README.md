# payment-gateway-web

Painel do merchant e checkout hospedado do payment gateway (React 19, Vite, Tailwind 4).

## Scripts

`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm test:watch`, `pnpm typecheck`, `pnpm lint`, `pnpm format`.

## Rodar contra um gateway local

1. **Gateway** (repositório `payment-gateway`). Variáveis de ambiente:
   - `SPRING_PROFILES_ACTIVE=local`
   - `GATEWAY_CORS_ORIGINS=http://localhost:5173`: a origem do painel, escrita exatamente assim
     (esquema, host e porta). O painel manda cookie (`credentials`), e o navegador só aceita uma
     origem exata, nunca `*`.
   - `GATEWAY_CHECKOUT_BASE_URL=http://localhost:5173/pay/` (o link do checkout aponta para este app)
   - `WEBHOOK_MTLS_PORT=0` (só em desenvolvimento local)
   - `GATEWAY_MAIL_HOST` vazio: com o gateway no perfil `local`, o link de verificação de e-mail e os
     links de convite saem no log do gateway, em vez de ir por e-mail.
2. **Este app.** Copie `.env.example` para `.env` (`VITE_API_URL=http://localhost:8080`) e rode `pnpm dev`.
   O painel abre em `http://localhost:5173`.
3. **Conta.** Abra `/signup` e crie a loja com e-mail e senha; não há mais chave para colar nem
   `dev_merchant.py`. Pegue o link de verificação no log do gateway e abra-o (`/verify/:token`).

## Telas

| Rota                 | O que é                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`             | entrar com e-mail e senha                                                                                                                                                                                |
| `/signup`            | criar a conta e a loja                                                                                                                                                                                   |
| `/forgot`            | pedir o link para redefinir a senha                                                                                                                                                                      |
| `/reset/:token`      | definir a nova senha                                                                                                                                                                                     |
| `/verify/:token`     | confirmar o e-mail                                                                                                                                                                                       |
| `/invite/:token`     | aceitar o convite para a equipe e definir a senha                                                                                                                                                        |
| `/app/orders`        | a tela inicial: lista de pedidos (filtro por status, paginação) e o formulário de novo pedido à esquerda; à direita, o pedido escolhido                                                                  |
| `/app/orders/:id`    | a mesma tela com o pedido aberto à direita: link de checkout, ações, estorno e tentativas                                                                                                                |
| `/app/orders/new`    | redireciona para `/app/orders`, onde o formulário fica                                                                                                                                                   |
| `/app/customers`     | lista de clientes                                                                                                                                                                                        |
| `/app/customers/new` | novo cliente                                                                                                                                                                                             |
| `/app/plans`         | planos: lista com filtro "só ativos", novo plano e edição de nome/ativo                                                                                                                                  |
| `/app/settings`      | configurações, em abas: Conta (loja e ambiente), Minha conta (nome e senha), Parcelamento (máximo, sem juros até, juros ao mês, prévia do que o pagador vê) e Equipe (convites e papéis, só para o dono) |
| `/pay/:token`        | checkout do pagador: Pix, boleto ou cartão (sem chave, o token vem na URL)                                                                                                                               |

Rotas da API usadas nas listas: `GET /v1/orders?status&limit&cursor` e `GET /v1/customers?limit&cursor`.
Planos e configurações usam `GET/POST /v1/plans`, `PATCH /v1/plans/{id}` e `GET/PUT /v1/installment-settings`.
O cursor é o id do último item da página anterior (não há `X-Next-Cursor`).
O token de acesso vai no header `Authorization: Bearer` e o ambiente (teste ou produção) em `X-Environment`, a cada requisição.

## Segurança

- O token de acesso fica só em memória (uma variável do módulo): não vai para storage do navegador
  nem URL. Um recarregamento o perde e o painel pede outro com o cookie.
- O cookie de refresh `gw_refresh` é do navegador (HttpOnly): o JavaScript do painel não o lê. Qualquer
  401 sem refresh possível e o logout apagam o token e o cache de consultas juntos.
- O ambiente escolhido vai em `X-Environment` a cada requisição; nenhuma chave de API passa pelo navegador.
- Papéis. O painel esconde o que o papel não pode fazer; o botão não é desabilitado, ele não existe na
  tela. Isso é só conforto: a API aplica a mesma tabela e nunca confia menos por causa disso
  (`src/auth/permissions.ts`).

  | Ação                                                                                          | Dono | Financeiro | Leitura |
  | --------------------------------------------------------------------------------------------- | :--: | :--------: | :-----: |
  | Ver cobranças, clientes, planos e configurações                                               | sim  |    sim     |   sim   |
  | Criar, cancelar e reembolsar cobranças; criar cliente; criar e editar plano; criar assinatura | sim  |    sim     |   não   |
  | Excluir cliente                                                                               | sim  |    não     |   não   |
  | Webhooks, chaves de API, provedores, parcelamento, equipe e loja                              | sim  |    não     |   não   |

- Os campos do cartão são zerados antes de qualquer envio e nunca vão para storage, cache nem URL
  (coberto por `src/checkout/cardDataNeverPersists.test.tsx`).
- `vercel.json` define CSP e `Referrer-Policy: no-referrer` (o token do checkout está na URL).
- O app não escreve logs.

## Deploy (Vercel)

`vercel.json` reescreve todo caminho para `index.html` (roteamento no cliente) e define os headers de segurança.

- O `connect-src` do CSP em `vercel.json` (padrão `http://localhost:8080`) tem de conter a origem de
  `VITE_API_URL`, senão o navegador bloqueia toda chamada à API. A Vercel lê `vercel.json` antes do
  build, então ele não é gerado: `scripts/write-vercel-json.mjs` roda no fim de `pnpm build` e falha
  se a origem não bater ou se `VITE_API_URL` não estiver definida. Edite `vercel.json` por ambiente.
- Defina `VITE_API_URL` no ambiente do build, e `GATEWAY_CORS_ORIGINS` / `GATEWAY_CHECKOUT_BASE_URL`
  no gateway com o domínio do deploy.

## CI

typecheck, lint, test e build, com pnpm 9 e Node 22 (`.github/workflows/ci.yml`).

## Teste de fumaça manual (Pix)

Não há suíte e2e automatizada: depende de um gateway com provedor simulado, que o CI não tem.
Roteiro, com o gateway na 8080 e `pnpm dev` na 5173:

1. Crie a conta em `/signup`, abra o link de verificação do log do gateway e entre em `/login`.
2. `/app/customers/new`: crie um cliente.
3. Em `/app/orders`, preencha "Nova cobrança" com esse cliente: o pedido abre à direita, com o link.
4. Gere o link de checkout e abra `/pay/:token` em outra aba.
5. Escolha Pix: o QR code e o copia-e-cola aparecem.
6. Simule o pagamento no provedor de teste: o checkout vira "pago" e o detalhe do pedido mostra o status pago.
7. Logout: o token some e `/app/orders` volta ao login.
