import type { ChangeEvent } from "react";
import { GatewayRequestError, messageFor } from "../support/gatewayError";
import type { Address } from "./types";

// What the panel may change on a customer; the document is set once, at creation.
export type EditableFields = { name: string; email: string } & Address;

export type CustomerFields = EditableFields & { document: string };

export type FieldBinding = {
  value: string;
  error?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

// The API names the field as the client sent it ("customer.address.zip"); the form keys are flat.
const FIELD_BY_API_NAME: Record<string, keyof CustomerFields> = {
  "customer.name": "name",
  "customer.document": "document",
  "customer.email": "email",
  "customer.address.street": "street",
  "customer.address.district": "district",
  "customer.address.city": "city",
  "customer.address.state": "state",
  "customer.address.zip": "zip",
};

// The gateway sends no `field`: CUSTOMER_INVALID starts its detail with the name of the field
// ("customer.address.zip must have 8 digits"), and that leading token is all there is to go on.
export function invalidFieldOf(error: unknown): keyof CustomerFields | undefined {
  if (!(error instanceof GatewayRequestError) || error.error.code !== "CUSTOMER_INVALID") {
    return undefined;
  }

  const [lead = ""] = error.error.detail.split(" ");

  return FIELD_BY_API_NAME[lead];
}

// For the form alert: a CUSTOMER_INVALID the form cannot pin on an input still says what is wrong.
export function customerFailureMessage(error: unknown): string {
  if (error instanceof GatewayRequestError && error.error.code === "CUSTOMER_INVALID") {
    return error.error.detail || messageFor(error);
  }

  return messageFor(error);
}

// A field error belongs next to its input; the form shows anything else in its alert.
export function fieldBinder<K extends keyof CustomerFields>(
  fields: Record<K, string>,
  setFields: (next: Record<K, string>) => void,
  error: unknown,
): (name: K) => FieldBinding {
  const invalidField = invalidFieldOf(error);
  const detail = error instanceof GatewayRequestError ? error.error.detail : undefined;

  return (name) => ({
    value: fields[name],
    error: invalidField === name ? detail : undefined,
    onChange: (event) => setFields({ ...fields, [name]: event.target.value }),
  });
}
