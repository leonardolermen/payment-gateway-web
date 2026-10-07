# Checkout que deixa voltar, cartão animado e cobrança recorrente — design

Data: 2026-10-07. Assume o painel em uma tela (`main`). Pedido do usuário (2026-10-07): a tela de pagar
não deixa voltar, não tem o cartão sendo montado, as parcelas com juros precisam aparecer, e a cobrança
precisa poder ser recorrente (assinatura) além de avulsa. Depende de duas specs do gateway:
`2026-10-07-parcelas-com-juros-design.md` (opções de parcela no checkout) e
`2026-10-07-assinatura-por-link-design.md` (assinatura que espera o primeiro pagamento). As partes 1 e 2
não dependem de nada e saem primeiro. Fora: cupom, troca de plano, operadores (Plano H).

## 1. Checkout: navegação e recuperação (só front)

**O passo vai para a URL.** `?etapa=metodo|cartao|pix|boleto` com `history.push` a cada avanço; o
`popstate` vira o evento `back` da máquina de estados. Assim o voltar do navegador volta um passo em vez
de sair. Nada além do nome do passo entra na URL (nunca dado de cartão). Recarregar continua derivando o
estado do servidor; a etapa da URL só é honrada se o servidor concordar (ex.: `?etapa=pix` sem Pix ativo
cai em `metodo`).

**Toda etapa tem saída.**
- Cartão: botão "Voltar" (antes de enviar) e, depois de uma recusa, "Tentar outro cartão" e "Escolher
  outra forma" — a spec de 2026-10-06 já pedia isso; o código ficou sem.
- Pix expirado: QR e copiar somem na hora (pelo relógio, sem esperar o polling), aparece "Este Pix
  expirou" com "Gerar novo Pix" e "Escolher outra forma".
- Cartão que volta `PENDING`/`CREATED`: tela "Estamos confirmando seu pagamento" com polling, nunca o
  formulário vazio sem mensagem.

**Foco e anúncio.** Ao trocar de etapa, o foco vai para o título da etapa (`tabIndex={-1}`) e uma região
`aria-live="polite"` anuncia "Pagamento com cartão", "Pix gerado" etc. Contagem regressiva do Pix e
"Copiado" também anunciados (o "Copiado" volta a "Copiar" em 2 s).

**Cabeçalho da etapa.** Indicador "Forma de pagamento → Dados → Confirmação" discreto, e o resumo
ganha o vencimento da cobrança (`expires_at`).

## 2. Cartão animado e formulário (só front)

`CardPreview`: frente com número agrupado conforme a bandeira, nome e validade preenchidos enquanto se
digita; cor e logo da bandeira detectada; vira para o verso quando o foco entra no CVV. CSS 3D
(`perspective`, `transform: rotateY`, `backface-visibility`), sem biblioteca. Placeholder `•••• ••••`
onde ainda não há dígito. Decorativo para leitor de tela (`aria-hidden`), o formulário continua sendo a
fonte. O teste `cardDataNeverPersists` passa a cobrir o preview (nada além do estado do formulário).

**Movimento como token.** `--motion-fast 150ms`, `--motion-base 240ms`, `--motion-slow 480ms`,
`--ease-standard`, `--ease-emphasized` no `index.css`; `@media (prefers-reduced-motion: reduce)` zera
todos. O flip usa `slow`; a troca de etapa usa `base` (fade + 8px de deslocamento).

**Formulário.** Campos com o `Field` do projeto (`aria-invalid`, `aria-describedby`), máscara por
bandeira (Amex 4-6-5), CVV com 4 dígitos no Amex e 3 nos demais, validade rejeita mês fora de 01–12 e
data passada, mensagem sob o campo em vez de botão desabilitado sem motivo. Botão "Pagar R$ 49,90"
(ou o total da parcela escolhida), com spinner e campos travados durante o envio. `Idempotency-Key`
gerada ao abrir a etapa e mantida até o fim, como no painel.

## 3. Parcelas (depende do gateway)

O `<select>` 1x–12x fixo sai. As opções vêm de `installment_options` do checkout:
"1x de R$ 120,00 sem juros", "3x de R$ 40,00 sem juros", "6x de R$ 21,40 (total R$ 128,40)". A opção
com juros mostra o total; o botão de pagar mostra o total da escolhida. Enquanto o gateway não tiver o
campo, o front mostra só "à vista" (nunca uma regra própria que possa divergir). No painel, uma tela
**Configurações → Parcelamento** lê e grava `/v1/installment-settings` com um simulador ao lado.

## 4. Cobrança recorrente no painel (depende do gateway)

O formulário "Nova cobrança" ganha o seletor **Avulsa | Recorrente**:
- **Avulsa**: como hoje (`POST /v1/orders`).
- **Recorrente**: cliente (obrigatório, cadastrado), plano (existente ou "novo plano" inline: valor,
  "a cada N dias/semanas/meses/anos", dias de teste), forma (cartão, Pix, boleto) e início
  (`POST /v1/plans` se for novo, depois `POST /v1/subscriptions`). Cartão sem cartão salvo cria a
  assinatura esperando o primeiro pagamento, e o link aparece à direita como numa cobrança avulsa.

Nova aba **Assinaturas**: lista (cliente, plano, valor, próxima cobrança, status), detalhe com as faturas
de cada ciclo ("Fatura 3 · 01/10–31/10 · Paga"), status `PAST_DUE` em destaque com a fatura aberta,
"Gerar novo link" e "Cobrar de novo" nela, e cancelar "no fim do período" ou "agora". No detalhe de
uma cobrança que é fatura, uma linha "Assinatura de {cliente} · fatura N" leva à assinatura.

## 5. Testes
Checkout: o voltar do navegador volta um passo (memory router + `popstate`); cartão → voltar → métodos;
recusa → escolher outra forma; Pix expirado esconde o QR no relógio e oferece novo; foco no título a cada
etapa; validade passada e CVV curto no Amex bloqueiam com mensagem; `cardDataNeverPersists` com o preview;
parcelas vindas do mock, o botão mostra o total. Painel: recorrente envia plano e assinatura na ordem
certa; assinatura `PAST_DUE` mostra a fatura aberta com as ações.

## 6. Decisões (para o `DECISOES.md`)
1. **Etapa do checkout na URL.** Rejeitado: só em memória (o voltar sai do checkout). Custo: a URL
   pode pedir uma etapa que o servidor não confirma; o servidor vence.
2. **Animação sem biblioteca, com tokens e `prefers-reduced-motion`.** Rejeitado: framer-motion (peso
   para um flip e um fade). Custo: transições mais elaboradas no futuro pedem reabrir a decisão.
3. **Parcelas só do gateway.** Rejeitado: tabela no front. Custo: sem o gateway novo, só "à vista".
