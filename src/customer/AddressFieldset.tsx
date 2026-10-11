import type { FieldBinding } from "./customerForm";
import { TextField } from "./TextField";
import type { Address } from "./types";

type Props = { legend: string; bind: (name: keyof Address) => FieldBinding };

export function AddressFieldset({ legend, bind }: Props) {
  return (
    <fieldset className="space-y-3 border-t border-line pt-4">
      <legend className="pr-2 text-sm font-medium text-muted">{legend}</legend>
      <TextField label="Rua" {...bind("street")} />
      <TextField label="Bairro" {...bind("district")} />
      <TextField label="Cidade" {...bind("city")} />
      <TextField label="UF" maxLength={2} {...bind("state")} />
      <TextField label="CEP" {...bind("zip")} />
    </fieldset>
  );
}
