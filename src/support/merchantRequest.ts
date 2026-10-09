import { readEnvironment } from "../auth/environment";
import { clearSession, readAccessToken, setAccessToken } from "../auth/session";
import { GatewayRequestError } from "./gatewayError";
import { request } from "./http";

type Init = Omit<NonNullable<Parameters<typeof request>[1]>, "credentials">;

export class Unauthenticated extends Error {
  constructor() {
    super("unauthenticated");
  }
}

const listeners = new Set<() => void>();

export function onUnauthenticated(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// One refresh at a time: ten lists failing together must not rotate the cookie ten times.
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshing ??= request<{ access_token: string }>("/v1/auth/refresh", {
    method: "POST",
    credentials: "include",
  })
    .then(({ data }) => {
      setAccessToken(data.access_token);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

// The ONLY way panel code talks to the API: it attaches the session and the environment, refreshes
// once on a 401, and turns a second 401 into "go back to login". `request` stays for the public
// checkout and for /v1/auth, which carry no session.
export async function merchantRequest<T>(
  path: string,
  init: Init = {},
): Promise<{ data: T; headers: Headers }> {
  try {
    return await send<T>(path, init);
  } catch (e) {
    if (!isUnauthorized(e)) {
      throw e;
    }
  }

  if (await refreshSession()) {
    try {
      return await send<T>(path, init);
    } catch (e) {
      if (!isUnauthorized(e)) {
        throw e;
      }
    }
  }

  clearSession();
  listeners.forEach((listener) => listener());
  throw new Unauthenticated();
}

function send<T>(path: string, init: Init) {
  const access = readAccessToken();

  return request<T>(path, {
    ...init,
    headers: {
      ...init.headers,
      "X-Environment": readEnvironment(),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
  });
}

function isUnauthorized(e: unknown): boolean {
  return e instanceof GatewayRequestError && e.error.status === 401;
}
