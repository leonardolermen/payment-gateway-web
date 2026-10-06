# Tema visual: claro quente, escuro premium

Data: 2026-10-06. Restyle das telas existentes, sem mudança de fluxo. Decisões do usuário: dois temas
(claro = direção "quente com personalidade", escuro = direção "escuro premium"), padrão segue o sistema,
botão para trocar lembrado no navegador.

## Tokens (CSS custom properties no `:root` e em `[data-theme="dark"]`)

| token | claro | escuro |
|---|---|---|
| `--bg` | `#fbf6ef` | `#0b0f14` |
| `--surface` | `#fffdf9` | `#121821` |
| `--surface-muted` | `#f3e9dc` | `#0e141b` |
| `--line` | `#eadfcf` | `#1f2a37` |
| `--text` | `#2b1d12` | `#e6edf3` |
| `--text-muted` | `#6b5744` | `#9fb0c3` |
| `--accent` | `#c2410c` | `#2dd4bf` |
| `--on-accent` | `#ffffff` | `#06211f` |
| `--danger` | `#b91c1c` | `#f87171` |
| `--ok-bg` / `--ok-fg` | `#dcfce7` / `#166534` | `#0f3b33` / `#5eead4` |
| `--warn-bg` / `--warn-fg` | `#ffedd5` / `#9a3412` | `#3b2f0f` / `#fbbf24` |
| `--neutral-bg` / `--neutral-fg` | `#f3e9dc` / `#6b5744` | `#1a2330` / `#8fa3b8` |
| `--font-body` | Inter | Inter |
| `--font-display` | Fraunces (serifa; títulos e valores) | Space Grotesk |
| `--radius` / `--radius-pill` | `14px` / `999px` (botões em pílula) | `14px` / `12px` |

Tailwind 4: expor os tokens em `@theme` (`--color-bg`, `--color-surface`, …, `--font-display`) para que as
classes `bg-surface`, `text-muted`, `font-display` existam. Fontes via Google Fonts no `index.html`
(Inter, Fraunces, Space Grotesk; `display=swap`). A CSP do `vercel.json` já permite `style-src` do
Google Fonts? Não: acrescentar `https://fonts.googleapis.com` em `style-src` e `https://fonts.gstatic.com`
em `font-src`.

## Tema em runtime

`src/support/theme.ts`: `resolveTheme(): "light"|"dark"` (escolha salva em `localStorage["gateway.theme"]`
vence; senão `prefers-color-scheme`), `applyTheme(theme)` (seta `data-theme` no `<html>`),
`toggleTheme()`, `onSystemThemeChange(cb)`. Tudo em try/catch (storage pode faltar). Um script inline
mínimo no `index.html` aplica o tema antes do primeiro render para não piscar; a CSP precisa de um
`'sha256-…'` para esse script, ou o script vai para um arquivo `theme-init.js` servido pelo app
(preferir o arquivo: sem hash para manter). `ThemeToggle` (sol/lua, `aria-label` "Alternar tema") no
cabeçalho do painel e no rodapé do checkout.

## Componentes (`src/support/ui/`)

`Button` (`variant: "primary"|"ghost"|"danger"`, `size`), `Card`, `Field` (rótulo, ajuda, erro,
`aria-invalid`), `Badge` (`tone: "ok"|"warn"|"neutral"|"danger"`), `PageHeader` (título, ação à direita),
`Table` (cabeçalho discreto em caixa alta). `StatusBadge` passa a usar `Badge` com o tom por status
(PAID/COMPLETED = ok; OPEN/PENDING/AUTHORIZED/CREATED = warn; CANCELED/EXPIRED/FAILED = neutral ou danger).

## Telas

- Painel: cabeçalho com marca (quadrado na cor de acento + nome do merchant), navegação Cobranças/Clientes,
  selo do ambiente (TEST âmbar, LIVE verde), `ThemeToggle`, Sair. Lista em `Card` com `Table`, botão
  "+ Nova cobrança". Detalhe em duas colunas (≥ 1024px): resumo + link + ações à esquerda, tentativas à
  direita; uma coluna no celular. Formulários com `Field`.
- Checkout: fundo `--bg`, cartão central (máx. 440px), nome do merchant em caixa alta pequena na cor de
  acento, valor em `font-display`, descrição, abas de método (ativa = acento), QR com moldura branca de
  8px (no escuro o QR precisa de fundo branco para o leitor), copia-e-cola em mono, botão largo, rodapé
  com contagem e `ThemeToggle`. Telas "pago" e "indisponível" com ícone simples em SVG inline.

## Testes

`theme.test.ts`: sem preferência salva segue o sistema (mock `matchMedia`); salva vence; storage
lançando não quebra; `toggleTheme` alterna e persiste. Um teste de tela: `ThemeToggle` alterna
`data-theme` no `<html>`. Os testes existentes continuam verdes sem mudança de asserção (texto, papéis e
fluxo não mudam); se um seletor por classe existir, troca-se por papel/texto.

## Fora de escopo

Logo real, animações, responsivo além de "cabe em 375px sem rolagem horizontal".
