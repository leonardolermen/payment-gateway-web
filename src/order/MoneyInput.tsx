import { useState } from "react";
import { formatBrl, parseBrl } from "../support/money";

type Props = { valueCents: number | null; onChange: (cents: number | null) => void };

// Intl separates "R$" from the number with a no-break space; a plain space keeps what the
// user sees identical to what they can type back.
function display(cents: number | null): string {
  return cents === null ? "" : formatBrl(cents).replace(/\s/g, " ");
}

export function MoneyInput({ valueCents, onChange }: Props) {
  const [text, setText] = useState(display(valueCents));
  const [invalid, setInvalid] = useState(false);

  function handleChange(next: string) {
    setText(next);
    setInvalid(false);
    // Reported while typing too: a submit click may land before the blur is processed.
    onChange(parseBrl(next));
  }

  function handleBlur() {
    const cents = parseBrl(text);
    onChange(cents);
    setInvalid(cents === null && text.trim() !== "");
    if (cents !== null) {
      setText(display(cents));
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor="amount" className="block text-sm">
        Valor
      </label>
      <input
        id="amount"
        inputMode="decimal"
        value={text}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        className="w-full rounded border px-2 py-1"
      />
      {invalid && <p className="text-sm text-red-700">Valor inválido</p>}
    </div>
  );
}
