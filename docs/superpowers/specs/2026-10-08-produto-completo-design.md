# O painel do lojista, completo — design (mapa do produto)

Data: 2026-10-08. Front do `payment-gateway`. Este documento é o **mapa**: todas as áreas que o painel
terá, o que cada uma espera da API, e a ordem em que front e back são entregues. A spec de
2026-10-08 (`painel-produto-design.md`) continua valendo como detalhe das áreas Clientes, Assinaturas,
Planos e Parcelamento; o que está aqui a complementa ou, onde diz, a substitui.

Decisões do usuário (2026-10-08): **só lojista** (o operador ganha app próprio quando o Plano H do
gateway sair do papel); **vários usuários por loja com papel** (dono, financeiro, leitura) e convite por
e-mail; **credenciais do banco em self-service**; login por e-mail e senha; "taxas" = parcelamento
(taxa do gateway por transação fica fora). Fora também: cupom, proração, Pix Automático, 2FA, app de
operador, redesign visual (o kit e os temas de 2026-10-06 ficam).

## 0. Como ler este documento
Cada seção é uma área do painel. O bloco **API** de cada seção lista o que o gateway ainda **não** tem;
o que já existe é citado pela rota. A §9 ordena tudo em PRs do gateway (B1–B9) e fases do front
(F1–F10). Uma fase do front só começa quando a PR do gateway que ela cita está em `main`.

## 1. Conta: signup, login, senha
Rotas fora de `/app`, sem header: `/signup`, `/login`, `/forgot`, `/reset/:token`, `/verify/:token`,
`/invite/:token`.

- **Signup**: nome da loja, nome do usuário, e-mail, senha (mínimo 10, barra de força, sem regra de
  caractere). Cria merchant + usuário **dono** + chaves TEST. Entra direto em TEST; **LIVE fica
  bloqueado até verificar o e-mail** (faixa no header).
- **Login**: e-mail + senha. Sem "lembrar": a sessão sobrevive à recarga pelo refresh e morre no logout
  ou em 30 dias sem uso.
- **Esqueci / redefinir**: link por e-mail, 1 h, uso único. "Esqueci" responde sempre "se existir,
  enviamos".
- **Trocar senha** em Configurações › Minha conta, pedindo a atual; derruba as outras sessões.

**Sessão.** Access token de 15 min **só em memória** + refresh token em cookie `HttpOnly; Secure;
SameSite=None` emitido pela API (origens diferentes). Ao recarregar, `POST /v1/auth/refresh` antes de
renderizar `/app`. Rejeitado: JWT em `localStorage` (XSS leva a sessão); cookie de sessão puro (CORS
com credentials em toda chamada). A chave `gk_…` sai do navegador: vira integração, em Configurações
› Chaves. `support/merchantRequest.ts` é o único lugar que põe o header, e troca de `Bearer gk_` para
`Bearer <access>` numa PR só.

**Papéis** — tabela única em `auth/permissions.ts`, consultada por todo botão (`can("refund")`):

| ação | dono | financeiro | leitura |
|---|---|---|---|
| ver tudo | ✓ | ✓ | ✓ |
| criar cobrança/cliente/plano/assinatura, cancelar | ✓ | ✓ | – |
| reembolsar, capturar, responder contestação, reenviar webhook | ✓ | ✓ | – |
| webhooks (endpoints), chaves de API, provedores, parcelamento | ✓ | – | – |
| equipe, dados da loja, excluir cliente | ✓ | – | – |

Botão sem permissão **não aparece**. A API recusa também (`403 FORBIDDEN_FOR_ROLE`); o front só evita o
clique.

**API:** `POST /v1/auth/signup | login | refresh | logout`, `POST /v1/auth/password/forgot | reset`,
`POST /v1/auth/email/verify`, `POST /v1/auth/invite/accept`, `GET /v1/me → {user:{id, name, email,
role, email_verified}, merchant:{id, name}, onboarding:{…}}`.

## 2. Início e ambiente
**Alternância TEST/LIVE** no header, clicável: muda o ambiente de toda consulta (header
`X-Environment`, nunca body). LIVE desabilitado com tooltip enquanto o e-mail não está verificado ou não
há provedor ativo em LIVE. Em TEST o header carrega a faixa âmbar do selo atual.

**Início** (`/app`), quatro blocos:
- **Números** (hoje / 7 d / 30 d): recebido, nº de pagamentos, ticket médio, conversão (pagas ÷
  criadas); variação contra o período anterior.
- **Atenção**: só contagens não-zero — `PENDING` há mais de 1 h, assinaturas `PAST_DUE`,
  contestações abertas, entregas `DEAD`; cada uma leva à lista filtrada.
- **Recebimentos por dia**: barras dos últimos 30 dias, Pix / boleto / cartão empilhados.
- **Últimas cobranças**: 8 linhas, a mesma linha da lista.

**Loja nova** (zero cobranças): checklist de onboarding — verificar e-mail, conectar provedor, primeira
cobrança de teste, cadastrar webhook, ativar LIVE. Some quando os cinco estão feitos.

**API:** `GET /v1/summary?period=today|7d|30d → {received, payments, average_ticket, conversion,
previous:{…}, attention:{pending_over_hour, past_due, open_disputes, dead_deliveries},
daily:[{date, pix, bolecode, card}]}` (um endpoint, cacheável 60 s; rejeitado montar no front a
partir das listas). `GET /v1/me.onboarding:{email_verified, provider_connected, first_order,
webhook, live_enabled}`.

## 3. Cobranças, reembolsos e exportação
**Cobranças** (`/app/orders`), o workspace de hoje com:
- **Filtros** na URL (`?status=&method=&from=&to=&q=`): status, método, período (presets + intervalo),
  busca por referência, cliente ou valor exato.
- **Linha do tempo** no detalhe: eventos do pagamento e entregas de webhook daquele pedido, numa lista
  cronológica — o que se olha quando "paguei e não liberou".
- **Captura** de cartão `AUTHORIZED` (`POST /v1/payments/{id}/capture`, total ou parcial).

**Reembolsos** — aba (`/app/orders/refunds`): pagamento, valor, status (`PENDING | COMPLETED |
FAILED`), criado em; falha mostra o motivo do banco e "tentar de novo". Criar continua no detalhe do
pedido.

**Exportar CSV** — exporta o filtro atual; colunas fixas (id, criado em, cliente, documento mascarado,
descrição, método, status, valor, pago em, referência). Até 10 mil linhas síncrono; acima, `202` e
arquivo por e-mail. UTF-8 com BOM e `;` — o que o Excel em português abre certo.

**API:** `GET /v1/orders` + `method`, `from`, `to`, `q`; `GET /v1/refunds?status&limit&cursor`;
`GET /v1/orders/export.csv?<filtros>`; `GET /v1/orders/{id}/timeline` (ordenação por tempo é do
back).

## 4. Clientes
Como na spec de 2026-10-08 §2, mais:
- Ações pelo papel (editar/excluir: dono; criar e "nova cobrança": dono e financeiro).
- **Notas internas** e **tags** no detalhe, filtro por tag na lista. API: `PATCH /v1/customers/{id}`
  aceita `notes`, `tags[]`; `GET /v1/customers?tag=`.
- **Importar CSV** (nome, documento, e-mail) com prévia e relatório de recusadas. API:
  `POST /v1/customers/import` (multipart, 202) e `GET /v1/customers/import/{id}`.

## 5. Assinaturas e Planos
Como na spec de 2026-10-08 §3–§4, mais:
- **MRR** no topo da lista (planos ativos normalizados a mês) e filtro por plano.
- **Pausar/retomar** (`POST /{id}/pause | resume`: não cobra enquanto pausada) e **trocar de plano**
  no próximo ciclo (`PATCH {plan_id}`, sem proração).
- Plano ganha **descrição** (vai ao checkout) e **assinantes ativos** na lista.

**API:** `pause`/`resume`, `PATCH plan_id`, `GET /v1/subscriptions/mrr`,
`PlanResponse.active_subscribers`, `description` no plano. Assinatura de cartão pelo link: spec do
gateway `2026-10-07-assinatura-por-link-design.md`.

## 6. Contestações
`/app/disputes`: pagamento, cliente, valor, motivo, status (`OPEN | UNDER_REVIEW | WON | LOST`),
prazo com badge vermelha a menos de 3 dias; filtro por status. Detalhe: pagamento (link), histórico de
estados, **evidência** (texto + até 5 anexos PDF/imagem de 5 MB), enviada uma vez e depois só leitura.
Abrir contestação pelo painel não existe: chega do banco; o `POST` atual continua admin.

**API:** `POST /v1/disputes/{id}/evidence` (multipart), `GET /v1/disputes/{id}/evidence`, `due_at`
no `DisputeResponse`.

## 7. Webhooks
`/app/webhooks`, duas abas:
- **Endpoints**: URL, eventos assinados, ativo, criado em. Criar e rotacionar mostram o segredo **uma
  vez**; desativar com confirmação; **enviar teste** (`ping`) mostra status e corpo da resposta.
- **Entregas**: evento, endpoint, status (`PENDING | DELIVERED | FAILED | DEAD`), tentativas, próxima;
  filtros por status, evento, endpoint, período; detalhe com payload, cada tentativa (HTTP, duração,
  trecho da resposta) e **reenviar**; "reenviar todas as mortas" com confirmação.

Dono mexe em endpoints; financeiro reenvia.

**API:** `POST /v1/webhooks/endpoints/{id}/test`, `PATCH /v1/webhooks/endpoints/{id}`,
`attempts[]` no `DeliveryResponse`, filtros `event`, `endpoint_id`, `from`, `to`.

## 8. Configurações
Abas, cada uma um conceito no código (`settings/store/`, `settings/providers/`, …):
- **Loja**: nome, CNPJ/CPF, e-mail de contato, **logo e cor do checkout** com prévia, nome no
  boleto/Pix. Dono.
- **Provedores** (por ambiente): **Itaú** (client id/secret, certificado + chave, chave Pix, conta
  beneficiária) e **Cielo** (merchant id/key). Estado **não configurado / conectado / falhou** e
  **Testar conexão**. Segredo nunca volta ("•••• definido em 02/10"), só se substitui. Dono.
- **Parcelamento**: a tela da fase 1, por ambiente.
- **Chaves de API**: prefixo, escopos, criada, último uso, expira; criar (escopos
  `read/write/refunds`, mostrada uma vez), rotacionar com convivência (24 h default, máx. 7 dias),
  revogar. Dono.
- **Equipe**: nome, e-mail, papel, último acesso; convidar por e-mail com papel (7 dias), mudar
  papel, remover; o último dono não se remove. Dono.
- **Minha conta**: nome, e-mail (com reverificação), senha, sessões ativas com "encerrar as outras".

**API:** `PATCH /v1/merchant` (+ `branding` em `GET /v1/checkout/{token}`),
`GET/PUT /v1/providers/{itau|cielo}/credentials` e `POST …/test` (hoje admin),
`/v1/merchant/api-keys` e `/v1/merchant/users` (Plano H, chamados pelo dono), `POST /v1/invites`,
`GET/DELETE /v1/me/sessions`.

## 9. Fila do back e ordem de entrega
Uma PR do gateway por linha; cada uma destrava telas. O front entrega por área, na ordem em que o
back fica pronto, com plano próprio por fase.

| # | Back (gateway) | Destrava no front |
|---|---|---|
| B1 | Listagens — PR #30 | F2 Clientes, F3 Assinaturas |
| B2 | Assinatura por link (spec pronta) | F3: cartão pelo link |
| B3 | **Usuários e sessão**: `auth/*`, `/v1/me`, papéis, verificação, convites | F4 Conta, ambiente, equipe, minha conta |
| B4 | Chaves e provedores self-service + testar conexão | F5 Configurações › Chaves, Provedores |
| B5 | `GET /v1/summary` + `onboarding` | F6 Início |
| B6 | Filtros de cobranças, `GET /v1/refunds`, timeline | F7 Cobranças e reembolsos |
| B7 | Notas/tags/importação; pausar/retomar, trocar plano, MRR, descrição | F8 CRM e assinaturas plus |
| B8 | Evidência e `due_at`; teste/`PATCH` de endpoint, `attempts[]`, filtros | F9 Contestações e webhooks |
| B9 | `PATCH /v1/merchant` + branding; CSV | F10 Loja e exportação |

**Ordem:** B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9. B3 é o maior e o que mais muda o front; vem logo
depois do que já está em andamento e antes de qualquer tela nova de configurações. Até B3, o front
continua com login por chave.

**Fases do front:** F1 (feita, PR #5) · F2 + F3 (B1, B2) · F4 (B3) · F5 (B4) · F6 (B5) · F7 (B6) ·
F8 (B7) · F9 (B8) · F10 (B9).

## 10. Decisões
1. **Só lojista; operador em app próprio depois.** Rejeitado: duas áreas no mesmo app — a do operador
   depende do Plano H, ainda não decidido. Custo: o operador segue por API até lá.
2. **Papéis desenhados desde já, com tabela única no front.** Rejeitado: um usuário por loja agora —
   acrescentar papéis depois exigiria revisar toda tela com ação. Custo: uma tabela de permissões.
3. **Credenciais em self-service.** Rejeitado: operador cadastra — tira o lojista do caminho de cada
   onboarding e contradiz o modelo A. Custo: um formulário sensível a mais, com segredo que não volta.
4. **Access token em memória + refresh em cookie HttpOnly.** Rejeitado: JWT em `localStorage`.
   Custo: uma chamada de refresh a cada recarga antes do primeiro render.
5. **Um endpoint de resumo para o Início.** Rejeitado: agregar listas no front. Custo: uma rota que
   só o painel usa.
6. **CSV com BOM e `;`.** Rejeitado: `,` e sem BOM — o Excel em português abre tudo numa coluna.
   Custo: quem importa em outra ferramenta troca o separador.
7. **Back em PRs pequenas, uma por área, front por fase atrás delas.** Rejeitado: um Plano I
   monolítico de "usuários + tudo". Custo: mais PRs; cada uma cabe num `verify` e num review.
