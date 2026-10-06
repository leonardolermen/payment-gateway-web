import { clearApiKey, readApiKey } from "../auth/apiKey";
import { GatewayRequestError } from "./gatewayError";
import { request } from "./http";

type Init = Omit<NonNullable<Parameters<typeof request>[1]>, "apiKey">;

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

// The ONLY way panel code talks to the API: it attaches the key and turns any 401 into
// "forget the key and go back to login". `request` stays for the public checkout, which has no key.
export async function merchantRequest<T>(
  path: string,
  init: Init = {},
): Promise<{ data: T; headers: Headers }> {
  try {
    return await request<T>(path, { ...init, apiKey: readApiKey() ?? undefined });
  } catch (e) {
    if (e instanceof GatewayRequestError && e.error.status === 401) {
      clearApiKey();
      listeners.forEach((listener) => listener());
      throw new Unauthenticated();
    }
    throw e;
  }
}
