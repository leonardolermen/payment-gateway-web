import { useState } from "react";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { formatBrl } from "../support/money";
import { MoneyInput } from "./MoneyInput";

type Props = {
  maxCents: number;
  pending: boolean;
  error: string | null;
  onConfirm: (amount: number | undefined) => void;
  onCancel: () => void;
};

export function RefundDialog({ maxCents, pending, error, onConfirm, onCancel }: Props) {
  const [partial, setPartial] = useState(false);
  const [cents, setCents] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleConfirm() {
    if (!partial) {
      onConfirm(undefined);
      return;
    }

    // Checked here so a typo never costs a request (and a provider-side refusal).
    if (cents === null || cents > maxCents) {
      setLocalError(`Informe um valor de até ${formatBrl(maxCents)}.`);
      return;
    }

    setLocalError(null);
    onConfirm(cents);
  }

  return (
    <ConfirmDialog
      title="Reembolsar"
      confirmLabel="Confirmar reembolso"
      pending={pending}
      error={localError ?? error}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    >
      <label className="mr-4 text-sm">
        <input
          type="radio"
          name="refund-kind"
          checked={!partial}
          onChange={() => setPartial(false)}
        />{" "}
        Total ({formatBrl(maxCents)})
      </label>
      <label className="text-sm">
        <input
          type="radio"
          name="refund-kind"
          checked={partial}
          onChange={() => setPartial(true)}
        />{" "}
        Parcial
      </label>
      {partial && <MoneyInput valueCents={cents} onChange={setCents} />}
    </ConfirmDialog>
  );
}
