import { useState } from "react";
import { isCpfOrCnpjShape } from "./document";
import { TextField } from "./TextField";
import type { CustomerChoice } from "./types";

type Fields = { name: string; document: string; email: string };

type Props = { onChange: (choice: CustomerChoice | null) => void };

export function InlineCustomer({ onChange }: Props) {
  const [fields, setFields] = useState<Fields>({ name: "", document: "", email: "" });

  // Reports nothing until the inline customer could be accepted, so the order form never
  // submits half of one.
  function update(patch: Partial<Fields>) {
    const next = { ...fields, ...patch };
    setFields(next);

    if (next.name.trim() === "" || !isCpfOrCnpjShape(next.document)) {
      onChange(null);
      return;
    }

    const email = next.email.trim();
    onChange({
      customer: {
        name: next.name.trim(),
        document: next.document,
        ...(email !== "" && { email }),
      },
    });
  }

  return (
    <div className="space-y-2">
      <TextField
        label="Nome"
        value={fields.name}
        onChange={(event) => update({ name: event.target.value })}
      />
      <TextField
        label="Documento"
        value={fields.document}
        onChange={(event) => update({ document: event.target.value })}
      />
      <TextField
        label="E-mail"
        type="email"
        value={fields.email}
        onChange={(event) => update({ email: event.target.value })}
      />
    </div>
  );
}
