// Same-origin paths only: `next` comes from the URL and must not become an open redirect.
export function safeNext(next: string | null, fallback = "/app/orders"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
