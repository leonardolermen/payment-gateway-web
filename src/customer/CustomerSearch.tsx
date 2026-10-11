import { useEffect, useState } from "react";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import type { CustomerFilter } from "./customerApi";
import { onlyDigits } from "./document";

const DEBOUNCE_MS = 300;
const DOCUMENT_LENGTH = 11;
const DOCUMENT_SHAPE = /^[\d.\-/\s]+$/;
// Eleven digits or more, each pair at most one ".", "-" or "/" apart: "529.982.247-25" inside a
// name is as much a document as "52998224725".
const DOCUMENT_RUN = /\d(?:[.\-/]?\d){10,}/;

type Props = { onChange: (filter: CustomerFilter) => void };
type Reading = { filter: CustomerFilter } | { incompleteDocument: true };

// A CPF/CNPJ with or without punctuation is an exact lookup; anything else is a "name contains".
// A partial document, or a name carrying a document, must never go out as `q`: that would send
// document digits to a substring search over names.
function read(value: string): Reading {
  const trimmed = value.trim();
  const digits = onlyDigits(trimmed);

  if (trimmed === "") {
    return { filter: {} };
  }

  if (DOCUMENT_SHAPE.test(trimmed)) {
    return digits.length >= DOCUMENT_LENGTH
      ? { filter: { document: digits } }
      : { incompleteDocument: true };
  }

  if (DOCUMENT_RUN.test(trimmed)) {
    return { incompleteDocument: true };
  }

  return { filter: { q: trimmed } };
}

export function CustomerSearch({ onChange }: Props) {
  const [value, setValue] = useState("");
  const reading = read(value);

  // Debounced so a name typed letter by letter reaches the gateway once, not once per keystroke.
  useEffect(() => {
    const debounced = read(value);
    const timer = window.setTimeout(
      () => onChange("filter" in debounced ? debounced.filter : {}),
      DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [value, onChange]);

  return (
    <div className="space-y-1">
      <input
        type="search"
        aria-label="Buscar por nome ou documento"
        aria-describedby={"incompleteDocument" in reading ? "customer-search-hint" : undefined}
        placeholder="Buscar por nome ou documento…"
        className={INPUT_CLASSES}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {"incompleteDocument" in reading && (
        <p id="customer-search-hint" className="text-sm text-muted">
          Digite o documento completo
        </p>
      )}
    </div>
  );
}
