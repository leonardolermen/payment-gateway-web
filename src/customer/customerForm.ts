import type { ChangeEvent } from "react";
import { GatewayRequestError } from "../support/gatewayError";
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

export function invalidFieldOf(error: unknown): keyof CustomerFields | undefined {
  if (!(error instanceof GatewayRequestError) || !error.error.field) {
    return undefined;
  }

  return FIELD_BY_API_NAME[error.error.field];
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
