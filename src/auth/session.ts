// Memory only: an access token in storage would survive the tab and be readable by any script.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function readAccessToken(): string | null {
  return accessToken;
}

export function clearSession(): void {
  accessToken = null;
}
