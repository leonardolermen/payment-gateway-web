import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { messageFor } from "../support/gatewayError";
import { findByDocument } from "./customerApi";
import { isCpfOrCnpjShape } from "./document";
import { InlineCustomer } from "./InlineCustomer";
import { TextField } from "./TextField";
import type { Customer, CustomerChoice } from "./types";

type Props = { value: CustomerChoice | null; onChange: (choice: CustomerChoice | null) => void };
type Mode = "existing" | "new";

function ExistingCustomer({ value, onChange }: Props) {
  const [document, setDocument] = useState("");
  const [found, setFound] = useState<Customer | null | undefined>(undefined);
  const search = useMutation({ mutationFn: findByDocument, onSuccess: setFound });
  const selected = value !== null && "customer_id" in value && value.customer_id === found?.id;

  return (
    <div className="space-y-2">
      <TextField
        label="Documento do cliente"
        value={document}
        onChange={(event) => setDocument(event.target.value)}
      />
      <button
        type="button"
        onClick={() => search.mutate(document)}
        disabled={!isCpfOrCnpjShape(document) || search.isPending}
        className="rounded border px-3 py-1 text-sm"
      >
        Buscar
      </button>

      {search.isError && <p role="alert">{messageFor(search.error)}</p>}
      {found === null && <p>Nenhum cliente com este documento.</p>}
      {found && (
        <div className="flex items-center gap-3 text-sm">
          <span>{found.name}</span>
          <span>{found.document}</span>
          <button
            type="button"
            onClick={() => onChange({ customer_id: found.id })}
            disabled={selected}
            className="rounded border px-2 py-1"
          >
            Selecionar
          </button>
          {selected && <span>Selecionado</span>}
        </div>
      )}
    </div>
  );
}

export function CustomerPicker({ value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("existing");

  function switchTo(next: Mode) {
    // A choice made in the other mode must not leak into the submit.
    onChange(null);
    setMode(next);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Cliente</legend>
      <div className="flex gap-4 text-sm">
        <label>
          <input
            type="radio"
            name="customer-mode"
            checked={mode === "existing"}
            onChange={() => switchTo("existing")}
          />{" "}
          Existente
        </label>
        <label>
          <input
            type="radio"
            name="customer-mode"
            checked={mode === "new"}
            onChange={() => switchTo("new")}
          />{" "}
          Novo
        </label>
      </div>

      {mode === "existing" ? (
        <ExistingCustomer value={value} onChange={onChange} />
      ) : (
        <InlineCustomer onChange={onChange} />
      )}
    </fieldset>
  );
}
