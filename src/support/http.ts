import { API_BASE } from "./apiBase";
import { GatewayRequestError, NetworkError, problemToError } from "./gatewayError";

type Init = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  apiKey?: string;
  idempotencyKey?: string;
};

// Never logs: requests carry the merchant API key and the checkout token.
export async function request<T>(
  path: string,
  init: Init = {},
): Promise<{ data: T; headers: Headers }> {
  const headers: Record<string, string> = { Accept: "application/json", ...init.headers };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (init.apiKey) {
    headers.Authorization = `Bearer ${init.apiKey}`;
  }
  if (init.idempotencyKey) {
    headers["Idempotency-Key"] = init.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new NetworkError();
  }

  const text = await response.text();
  const parsed: unknown = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new GatewayRequestError(problemToError(response.status, parsed, response.headers));
  }

  return { data: parsed as T, headers: response.headers };
}

// A gateway or proxy error page is HTML, not JSON; keep the text so problemToError can fall back.
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
