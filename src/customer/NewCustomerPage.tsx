import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { can } from "../auth/permissions";
import { useMe } from "../auth/useMe";
import { GatewayRequestError, messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { PageHeader } from "../support/ui/PageHeader";
import { AddressFieldset } from "./AddressFieldset";
import { createCustomer, customerKeys } from "./customerApi";
import { fieldBinder, invalidFieldOf, type CustomerFields } from "./customerForm";
import { onlyDigits } from "./document";
import { TextField } from "./TextField";
import type { NewCustomer } from "./types";

const EMPTY: CustomerFields = {
  name: "",
  document: "",
  email: "",
  street: "",
  district: "",
  city: "",
  state: "",
  zip: "",
};

function toBody(fields: CustomerFields): NewCustomer {
  const { street, district, city, state, zip } = fields;
  const hasAddress = [street, district, city, state, zip].some((value) => value.trim() !== "");

  return {
    name: fields.name.trim(),
    document: onlyDigits(fields.document),
    ...(fields.email.trim() !== "" && { email: fields.email.trim() }),
    ...(hasAddress && { address: { street, district, city, state, zip } }),
  };
}

// Reachable by URL even when the nav hides it. Waits for `me` instead of using useCan, which is
// false while loading and would bounce a FINANCE user away on a cold load.
export function NewCustomerPage() {
  const role = useMe().data?.user.role;

  if (role === undefined) {
    return null;
  }

  if (!can(role, "create_customer")) {
    return <Navigate to="/app/customers" replace />;
  }

  return <NewCustomerForm />;
}

function NewCustomerForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [fields, setFields] = useState<CustomerFields>(EMPTY);

  const create = useMutation({
    mutationFn: (body: NewCustomer) => createCustomer(body, idempotencyKey.current),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      navigate("/app/customers");
    },
  });

  const failure = create.error instanceof GatewayRequestError ? create.error.error : null;
  const duplicateId = failure?.code === "CUSTOMER_EXISTS" ? failure.extras.customer_id : undefined;
  const invalidField = invalidFieldOf(create.error);
  const bind = fieldBinder(fields, setFields, create.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(toBody(fields));
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Novo cliente" />

      <Card>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <TextField label="Nome" {...bind("name")} />
          <TextField label="Documento" {...bind("document")} />
          <TextField label="E-mail" type="email" {...bind("email")} />

          <AddressFieldset legend="Endereço (opcional)" bind={bind} />

          {create.isError && !invalidField && (
            <p role="alert" className="text-sm text-danger">
              {messageFor(create.error)}{" "}
              {typeof duplicateId === "string" && <code>{duplicateId}</code>}
            </p>
          )}

          <Button type="submit" disabled={create.isPending}>
            Salvar
          </Button>
        </form>
      </Card>
    </section>
  );
}
