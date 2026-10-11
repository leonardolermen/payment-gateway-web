import { GatewayRequestError, messageFor } from "../support/gatewayError";

export function codeOf(error: unknown): string | undefined {
  return error instanceof GatewayRequestError ? error.error.code : undefined;
}

// Routes a gateway error to the field whose code names it; anything else becomes the form alert.
export function fieldErrors<Field extends string>(
  error: unknown,
  fieldForCode: Partial<Record<string, Field>>,
): Partial<Record<Field | "form", string>> {
  const code = codeOf(error);
  const field = code === undefined ? undefined : fieldForCode[code];

  return { [field ?? "form"]: messageFor(error) } as Partial<Record<Field | "form", string>>;
}
