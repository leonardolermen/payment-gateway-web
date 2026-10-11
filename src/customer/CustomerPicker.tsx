import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { findByDocument } from "./customerApi";
import { isCpfOrCnpjShape } from "./document";
import { InlineCustomer } from "./InlineCustomer";
import { TextField } from "./TextField";
import type { Customer, CustomerChoice } from "./types";

type Props = {
  value: CustomerChoice | null;
  onChange: (choice: CustomerChoice | null) => void;
  // A customer chosen elsewhere (the "Nova cobrança" shortcut): shown as if a search had found it.
  preselected?: Customer;
};
type Mode = "existing" | "new";

function ExistingCustomer({ value, onChange, preselected }: Props) {
  const [document, setDocument] = useState("");
  const [found, setFound] = useState<Customer | null | undefined>(undefined);
  const search = useMutation({ mutationFn: findByDocument, onSuccess: setFound });
  const shown = found === undefined ? preselected : found;
  const selected = value !== null && "customer_id" in value && value.customer_id === shown?.id;

  return (
    <div className="space-y-2">
      <TextField
        label="Documento do cliente"
        placeholder="Buscar por CPF…"
        value={document}
        onChange={(event) => setDocument(event.target.value)}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => search.mutate(document)}
        disabled={!isCpfOrCnpjShape(document) || search.isPending}
      >
        Buscar
      </Button>

      {search.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(search.error)}
        </p>
      )}
      {shown === null && <p className="text-sm text-muted">Nenhum cliente com este documento.</p>}
      {shown && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted p-3 text-sm">
          <span className="font-medium">{shown.name}</span>
          <span className="font-mono text-xs text-muted">{shown.document}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ customer_id: shown.id })}
            disabled={selected}
          >
            Selecionar
          </Button>
          {selected && <span className="text-ok-fg">Selecionado</span>}
        </div>
      )}
    </div>
  );
}

export function CustomerPicker({ value, onChange, preselected }: Props) {
  const [mode, setMode] = useState<Mode>("existing");

  function switchTo(next: Mode) {
    // A choice made in the other mode must not leak into the submit.
    onChange(null);
    setMode(next);
  }

  return (
    <fieldset className="space-y-3 border-t border-line pt-4">
      <legend className="pr-2 text-[10px] font-medium tracking-wider text-muted uppercase">
        Cliente
      </legend>
      <div className="flex gap-4 text-sm [&_input]:accent-accent">
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
        <ExistingCustomer value={value} onChange={onChange} preselected={preselected} />
      ) : (
        <InlineCustomer onChange={onChange} />
      )}
    </fieldset>
  );
}
