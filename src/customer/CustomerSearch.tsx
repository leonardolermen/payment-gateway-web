import { useEffect, useState } from "react";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import type { CustomerSearch as Search } from "./customerApi";
import { onlyDigits } from "./document";

const DEBOUNCE_MS = 300;
const DOCUMENT_SHAPE = /^[\d.\-/\s]+$/;

type Props = { onChange: (search: Search) => void };

// A CPF/CNPJ with or without punctuation is an exact lookup; anything else is a "name contains".
function searchFor(value: string): Search {
  const trimmed = value.trim();

  if (trimmed === "") {
    return {};
  }

  if (onlyDigits(trimmed).length >= 11 && DOCUMENT_SHAPE.test(trimmed)) {
    return { document: onlyDigits(trimmed) };
  }

  return { q: trimmed };
}

export function CustomerSearch({ onChange }: Props) {
  const [value, setValue] = useState("");

  // Debounced so a name typed letter by letter reaches the gateway once, not once per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => onChange(searchFor(value)), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, onChange]);

  return (
    <input
      type="search"
      aria-label="Buscar por nome ou documento"
      placeholder="Buscar por nome ou documento…"
      className={INPUT_CLASSES}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}
