// `next` comes from the URL and must not become an open redirect. Checking for a leading "/" is not
// enough: the URL parser reads "\" as "/" and drops tabs/newlines, so "/\evil.com" and "/\t/evil.com"
// resolve to "//evil.com". Resolve against our origin and refuse those characters outright.
// eslint-disable-next-line no-control-regex -- control characters are exactly what this rejects
const UNSAFE_CHARACTERS = /[\\\x00-\x1f]/;

export function safeNext(next: string | null, fallback = "/app/orders"): string {
  if (!next || !next.startsWith("/") || UNSAFE_CHARACTERS.test(next)) {
    return fallback;
  }

  const url = new URL(next, window.location.origin);

  if (url.origin !== window.location.origin) {
    return fallback;
  }

  // Dot segments normalise "/..//evil.com" into "//evil.com": the result itself must start with one slash.
  const result = url.pathname + url.search + url.hash;

  return /^\/[\\/]/.test(result) ? fallback : result;
}
