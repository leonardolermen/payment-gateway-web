# payment-gateway-web

Merchant panel and hosted checkout for the payment gateway (React 19, Vite, Tailwind 4).

## Scripts

`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm test:watch`, `pnpm typecheck`, `pnpm lint`, `pnpm format`.

## Configuration

Copy `.env.example` to `.env`. `VITE_API_URL` is the gateway API origin.

## Deploy (Vercel)

`vercel.json` rewrites every path to `index.html` (client-side routing) and sets security headers.

- `https://api.REPLACE-ME` in the `Content-Security-Policy` is a placeholder: replace it with the
  API host of each environment, otherwise the browser blocks every API call.
- `Referrer-Policy: no-referrer` is deliberate: the checkout token travels in the URL
  (`/pay/:token`) and must not leak through the `Referer` header.
