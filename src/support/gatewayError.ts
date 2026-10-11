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
  PROVIDER_CREDENTIALS_INVALID: "Credencial inválida.",
  CUSTOMER_EXISTS: "Já existe um cliente com este documento.",
  CUSTOMER_INVALID: "Dados do cliente inválidos.",
  CUSTOMER_HAS_ACTIVE_SUBSCRIPTION: "Este cliente tem uma assinatura ativa.",
  PLAN_INACTIVE: "Este plano está inativo.",
  CARD_REQUIRED: "Escolha um cartão ou envie o link para o pagador.",
  CARD_NOT_OWNED_BY_CUSTOMER: "Este cartão não é deste cliente.",
  CUSTOMER_ADDRESS_REQUIRED: "Boleto precisa do endereço do cliente.",
  SUBSCRIPTION_NOT_ACTIVE: "Esta assinatura não está ativa.",
  IDEMPOTENCY_KEY_REUSED:
    "A tentativa anterior pode ter sido registrada. Confira antes de tentar de novo.",
  IN_PROGRESS: "Ainda processando a tentativa anterior. Aguarde alguns segundos.",
  INVALID_REQUEST: "Requisição inválida.",
  RATE_LIMITED: "Muitas tentativas. Aguarde um instante.",
  EMAIL_TAKEN: "Este e-mail já tem conta.",
  WEAK_PASSWORD: "A senha precisa ter pelo menos 10 caracteres.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  SESSION_EXPIRED: "Sua sessão expirou. Entre de novo.",
  TOKEN_EXPIRED: "Este link não vale mais.",
  ALREADY_VERIFIED: "Seu e-mail já está confirmado.",
  RESEND_TOO_SOON: "Aguarde alguns minutos antes de reenviar.",
  AUTH_BUSY: "Muita gente entrando agora. Tente em instantes.",
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail para usar produção.",
  FORBIDDEN_FOR_ROLE: "Seu papel não permite esta ação.",
  LAST_OWNER: "A loja precisa de pelo menos um dono.",
  OWN_ACCOUNT: "Use Minha conta para a sua própria conta.",
  ORIGIN_NOT_ALLOWED: "Origem não permitida.",
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

// A 409 names what is in the way (the subscription that still charges a card or a customer) in the
// gateway's own words, which say more than any fixed message the panel could hold.
export function conflictMessageFor(error: unknown): string {
  if (error instanceof GatewayRequestError && error.error.status === 409 && error.error.detail) {
    return error.error.detail;
  }

  return messageFor(error);
}

// A 400 or 422 is the gateway refusing the request before it created anything, so the corrected
// form may go out under a new Idempotency-Key. Anything else (no answer, 5xx, a 409 for a request
// still in flight, a reused key) may have created it: the key stays, so a retry replays instead of
// creating a second one.
export function provesNothingWasCreated(error: unknown): boolean {
  if (!(error instanceof GatewayRequestError)) {
    return false;
  }

  const { status, code } = error.error;

  return (status === 400 || status === 422) && code !== "IDEMPOTENCY_KEY_REUSED";
}
