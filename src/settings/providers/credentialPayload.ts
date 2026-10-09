import { GatewayRequestError, messageFor } from "../../support/gatewayError";
import { isSecret } from "./providerFields";
import type { FieldSpec } from "./types";

export type FormErrors = Partial<Record<string, string>>;

export function initialValues(
  specs: FieldSpec[],
  storedFields: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    specs.map((spec) => [
      spec.name,
      isSecret(spec) ? "" : (storedFields[spec.name] ?? spec.defaultValue ?? ""),
    ]),
  );
}

/**
 * The gateway merges only secrets: a public field absent from the PUT is dropped from the stored
 * credential. So every public value goes on every save, while a secret goes only when typed (or as
 * "" when the merchant asked to remove it) — a blank secret means "keep what is stored".
 */
export function credentialPayload(
  specs: FieldSpec[],
  values: Record<string, string>,
  removed: Record<string, boolean>,
): Record<string, string> {
  const entries = specs
    .map((spec) => [spec.name, removed[spec.name] ? "" : (values[spec.name] ?? "").trim()] as const)
    .filter(([name, value]) => value !== "" || removed[name]);

  return Object.fromEntries(entries);
}

// A 422 names the offending field in the gateway's spelling, which is also our input name; any
// field the form does not show lands on the form alert instead of disappearing.
export function credentialErrors(error: unknown, specs: FieldSpec[]): FormErrors {
  const field = error instanceof GatewayRequestError ? error.error.field : undefined;
  const shown = specs.some((spec) => spec.name === field);

  return { [shown && field ? field : "form"]: messageFor(error) };
}
