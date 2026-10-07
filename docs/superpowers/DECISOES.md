# Decisões

Append-only. Cada decisão registra a alternativa rejeitada e o custo de estar errada.

## 2026-10-06 — Repositório separado, com CORS
Rejeitado: estático servido pelo Spring.
Custo se errado: lista de origens por ambiente e a chave do merchant num domínio diferente da API.

## 2026-10-06 — Chave em `sessionStorage`, não `localStorage`
Rejeitado: `localStorage`.
Custo se errado: cola a chave de novo a cada aba nova. É o comportamento certo até existirem chaves de escopo reduzido (Plano H).

## 2026-10-06 — Máquina de estados do checkout fora do React
Rejeitado: estado espalhado em hooks do componente.
Custo se errado: um arquivo a mais. Ganha-se testar cada transição sem DOM e manter os dados do cartão fora dela.

## 2026-10-06 — Cartão direto para o gateway
Rejeitado: tokenização no front (não há provider de tokenização hoje).
Custo se errado: a página de checkout está no escopo PCI, como o gateway já está.

## 2026-10-06 — Cursor é o último id, sem `X-Next-Cursor`
Rejeitado: cursor opaco em header, como a spec §3 descrevia.
Custo se errado: se o gateway passar a devolver cursor opaco, a paginação das listas quebra e o front precisa mudar junto. O plano seguiu o contrato real do gateway (`cursor=<último id>`, mesmo padrão de payments).

## 2026-10-06 — `Authorization: Bearer`, não `X-Api-Key`
Rejeitado: header `X-Api-Key`.
Custo se errado: toda chamada autenticada volta 401 e o painel cai no login; o header está num lugar só (`src/support/http.ts`).

## 2026-10-06 — Cobranças numa tela só: lista e formulário à esquerda, pedido à direita
A tela inicial segue o mockup aprovado: `/app/orders` mostra a lista e "Nova cobrança"; `/app/orders/:id` é a
mesma tela com o pedido aberto à direita (rota filha), e `/app/orders/new` redireciona. Lista com as quatro
colunas do mockup (criado, cliente, valor, status); descrição e método ficam no detalhe. Referência e
vencimento do formulário ficam recolhidos em "Referência e vencimento".
Rejeitado: uma página por ação, como antes — criar e conferir o link custava duas navegações.
Custo se errado: em tela estreita a lista e o pedido se empilham (o pedido primeiro); quem precisar da
descrição na lista abre o pedido.

## 2026-10-07 — Etapa do checkout na URL; o servidor vence
`?etapa=metodo|cartao|pix|boleto|confirmacao`, com uma entrada nova de histórico a cada avanço: o voltar do
navegador volta uma etapa. Voltar de um Pix ou boleto cancela a tentativa no servidor antes; se o cancelamento
falha, a etapa volta para a URL e o pagador continua onde estava. Uma URL pedindo uma etapa que o estado não
confirma é reescrita.
Rejeitado: o passo só em memória — o voltar saía do checkout.
Custo se errado: cada avanço é uma entrada de histórico; quem pagou e aperta voltar passa por elas até sair.

## 2026-10-07 — Animação sem biblioteca, com tokens de movimento
O cartão que vira e a entrada de cada etapa usam CSS (`--motion-*`, `--ease-*`), zerados por
`prefers-reduced-motion`. O cartão desenhado é decorativo (`aria-hidden`) e só mostra o estado do formulário.
Rejeitado: framer-motion — peso de biblioteca para um flip e um fade.
Custo se errado: transições mais elaboradas pedem reabrir a decisão.

## 2026-10-07 — Parcelas só do gateway
O formulário lista `installment_options` do checkout; sem o campo, só "à vista". O botão mostra o total da
opção escolhida.
Rejeitado: manter 1x–12x fixo no front — a regra de mínimo e de juros divergiria da do gateway.
Custo se errado: enquanto o gateway não publicar as opções, o checkout não parcela.

## 2026-10-07 — Recorrente é uma assinatura, criada pelo mesmo formulário
"Nova cobrança" escolhe entre Avulsa (`POST /v1/orders`) e Recorrente: cliente novo se preciso, plano novo
se preciso e a assinatura (`POST /v1/subscriptions`), nessa ordem, cada passo com sua `Idempotency-Key`.
Documento já cadastrado (`CUSTOMER_EXISTS`) vira o cliente da assinatura. Assinatura no cartão abre a 1ª
fatura à direita, com o link, como uma cobrança avulsa.
Rejeitado: uma tela própria de assinatura — o lojista pensa em "cobrar", e o tipo é um detalhe da cobrança.
Custo se errado: um erro no meio (plano criado, assinatura recusada) deixa um plano sem assinatura; o
reenvio reaproveita o plano pela mesma chave, mas um formulário recarregado cria outro.

