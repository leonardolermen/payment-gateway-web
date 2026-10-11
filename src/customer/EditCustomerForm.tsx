import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { AddressFieldset } from "./AddressFieldset";
import { customerKeys, patchCustomer } from "./customerApi";
import { fieldBinder, invalidFieldOf, type EditableFields } from "./customerForm";
import { TextField } from "./TextField";
import type { Address, Customer, CustomerPatch } from "./types";

type Props = { customer: Customer; onClose: () => void };

const ADDRESS_KEYS: (keyof Address)[] = ["street", "district", "city", "state", "zip"];

function editableFieldsOf(customer: Customer): EditableFields {
  return {
    name: customer.name,
    email: customer.email ?? "",
    street: customer.address?.street ?? "",
    district: customer.address?.district ?? "",
    city: customer.address?.city ?? "",
    state: customer.address?.state ?? "",
    zip: customer.address?.zip ?? "",
  };
}

function addressOf(fields: EditableFields): Address {
  return {
    street: fields.street.trim(),
    district: fields.district.trim(),
    city: fields.city.trim(),
    state: fields.state.trim(),
    zip: fields.zip.trim(),
  };
}

// The address goes as a whole when any part of it changed: the API replaces it, never merges it.
function changesOf(original: EditableFields, edited: EditableFields): CustomerPatch {
  const name = edited.name.trim();
  const email = edited.email.trim();
  const address = addressOf(edited);
  const addressChanged = ADDRESS_KEYS.some((key) => address[key] !== original[key].trim());

  return {
    ...(name !== original.name.trim() && { name }),
    ...(email !== original.email.trim() && { email }),
    ...(addressChanged && { address }),
  };
}

export function EditCustomerForm({ customer, onClose }: Props) {
  const queryClient = useQueryClient();
  // Frozen at open: a refetch landing mid-edit must not turn an untouched field into a change.
  const [original] = useState(() => editableFieldsOf(customer));
  const [fields, setFields] = useState<EditableFields>(original);

  const save = useMutation({
    mutationFn: (patch: CustomerPatch) => patchCustomer(customer.id, patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(customerKeys.detail(customer.id), saved);
      // The list shows the name too, and a search by the old name must not find it.
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      onClose();
    },
  });

  const patch = changesOf(original, fields);
  const nothingChanged = Object.keys(patch).length === 0;
  const invalidField = invalidFieldOf(save.error);
  const bind = fieldBinder(fields, setFields, save.error);

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(patch);
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <TextField label="Nome" {...bind("name")} />

      {/* Not an input: the document is the customer's identity at the gateway and never changes. */}
      <dl className="space-y-0.5">
        <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">Documento</dt>
        <dd className="font-mono text-xs">{customer.document}</dd>
        <dd className="text-xs text-muted">O documento não muda.</dd>
      </dl>

      <TextField label="E-mail" type="email" {...bind("email")} />

      <AddressFieldset legend="Endereço" bind={bind} />

      {save.isError && !invalidField && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(save.error)}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={nothingChanged || save.isPending}>
          Salvar
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
