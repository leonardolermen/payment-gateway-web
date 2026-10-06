export type GatewayError = {
  status: number;
  code: string;
  detail: string;
  field?: string;
  extras: Record<string, unknown>;
  retryAfterSeconds?: number;
};

export class GatewayRequestError extends Error {
  // Explicit field instead of a parameter property: the TS config is erasableSyntaxOnly.
  readonly error: GatewayError;

  constructor(error: GatewayError) {
    super(error.detail);
    this.error = error;
  }
}

export class NetworkError extends Error {
  constructor() {
    super("network");
  }
}

const KNOWN = ["type", "title", "status", "detail", "instance"];

export function problemToError(status: number, body: unknown, headers: Headers): GatewayError {
  const retry = headers.get("Retry-After");
  const retryAfterSeconds = retry && /^\d+$/.test(retry) ? Number(retry) : undefined;

  if (typeof body !== "object" || body === null) {
    return { status, code: "UNKNOWN", detail: "", extras: {}, retryAfterSeconds };
  }

  const problem = body as Record<string, unknown>;
  const type = typeof problem.type === "string" ? problem.type : "";
  const code = type.startsWith("urn:gateway:") ? type.slice("urn:gateway:".length) : "UNKNOWN";
  const extras = Object.fromEntries(
    Object.entries(problem).filter(([key]) => !KNOWN.includes(key)),
  );

  return {
    status,
    code,
    detail: typeof problem.detail === "string" ? problem.detail : "",
    field: typeof problem.field === "string" ? problem.field : undefined,
    extras,
    retryAfterSeconds,
  };
}

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Chave de API inválida.",
  NOT_FOUND: "Não encontrado.",
  CHECKOUT_ORDER_CLOSED: "Este link de pagamento não está mais disponível.",
  ORDER_HAS_ACTIVE_PAYMENT: "Já existe uma tentativa de pagamento em andamento.",
  ORDER_CLOSED: "Esta cobrança já foi encerrada.",
  ALREADY_PAID: "Esta cobrança já foi paga.",
  CARD_DECLINED: "Cartão recusado. Tente outro cartão ou outro método.",
  CHECKOUT_CANNOT_CANCEL_CARD: "Um pagamento com cartão não pode ser cancelado por aqui.",
  PROVIDER_CREDENTIALS_MISSING: "Este método não está disponível para esta loja.",
  CUSTOMER_EXISTS: "Já existe um cliente com este documento.",
  CUSTOMER_INVALID: "Dados do cliente inválidos.",
  INVALID_REQUEST: "Requisição inválida.",
  RATE_LIMITED: "Muitas tentativas. Aguarde um instante.",
};

export function messageFor(error: unknown): string {
  if (error instanceof NetworkError) {
    return "Não foi possível falar com o servidor. Tente de novo.";
  }

  if (error instanceof GatewayRequestError) {
    return MESSAGES[error.error.code] ?? (error.error.detail || "Algo deu errado.");
  }

  return "Algo deu errado.";
}
