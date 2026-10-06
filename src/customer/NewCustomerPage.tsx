import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { GatewayRequestError, messageFor } from "../support/gatewayError";
import { createCustomer, customerKeys } from "./customerApi";
import { onlyDigits } from "./document";
import { TextField } from "./TextField";
import type { NewCustomer } from "./types";

const EMPTY = {
  name: "",
  document: "",
  email: "",
  street: "",
  district: "",
  city: "",
  state: "",
  zip: "",
};

type Fields = typeof EMPTY;

// The API names the field as the client sent it ("customer.address.zip"); the form keys are flat.
const FIELD_BY_API_NAME: Record<string, keyof Fields> = {
  "customer.name": "name",
  "customer.document": "document",
  "customer.email": "email",
  "customer.address.street": "street",
  "customer.address.district": "district",
  "customer.address.city": "city",
  "customer.address.state": "state",
  "customer.address.zip": "zip",
};

function toBody(fields: Fields): NewCustomer {
  const { street, district, city, state, zip } = fields;
  const hasAddress = [street, district, city, state, zip].some((value) => value.trim() !== "");

  return {
    name: fields.name.trim(),
    document: onlyDigits(fields.document),
    ...(fields.email.trim() !== "" && { email: fields.email.trim() }),
    ...(hasAddress && { address: { street, district, city, state, zip } }),
  };
}

export function NewCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [fields, setFields] = useState<Fields>(EMPTY);

  const create = useMutation({
    mutationFn: (body: NewCustomer) => createCustomer(body, idempotencyKey.current),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      navigate("/app/customers");
    },
  });

  const failure = create.error instanceof GatewayRequestError ? create.error.error : null;
  const duplicateId = failure?.code === "CUSTOMER_EXISTS" ? failure.extras.customer_id : undefined;
  const invalidField = failure?.field ? FIELD_BY_API_NAME[failure.field] : undefined;

  // A field error belongs next to its input; anything else goes in the alert.
  function errorFor(name: keyof Fields): string | undefined {
    return invalidField === name ? failure?.detail : undefined;
  }

  function bind(name: keyof Fields) {
    return {
      value: fields[name],
      error: errorFor(name),
      onChange: (event: { target: { value: string } }) =>
        setFields({ ...fields, [name]: event.target.value }),
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(toBody(fields));
  }

  return (
    <section className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Novo cliente</h1>

      <form onSubmit={submit} className="space-y-3" noValidate>
        <TextField label="Nome" {...bind("name")} />
        <TextField label="Documento" {...bind("document")} />
        <TextField label="E-mail" type="email" {...bind("email")} />

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Endereço (opcional)</legend>
          <TextField label="Rua" {...bind("street")} />
          <TextField label="Bairro" {...bind("district")} />
          <TextField label="Cidade" {...bind("city")} />
          <TextField label="UF" maxLength={2} {...bind("state")} />
          <TextField label="CEP" {...bind("zip")} />
        </fieldset>

        {create.isError && !invalidField && (
          <p role="alert">
            {messageFor(create.error)}{" "}
            {typeof duplicateId === "string" && <code>{duplicateId}</code>}
          </p>
        )}

        <button
          type="submit"
          disabled={create.isPending}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Salvar
        </button>
      </form>
    </section>
  );
}
