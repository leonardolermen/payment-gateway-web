import { useState } from "react";
import { MoneyInput } from "../order/MoneyInput";
import { formatBrl } from "../support/money";
import { Card } from "../support/ui/Card";
import { previewInstallments } from "./installmentPreview";
import type { InstallmentSettingsInput } from "./types";

// R$ 1.000,00: round enough that the merchant can check the interest in their head.
const SAMPLE_AMOUNT = 100_000;

type Props = { settings: InstallmentSettingsInput | null };

// What the payer will see on the checkout for the values typed on the left, before they are
// saved: the merchant judges the rate by its effect, not by the number.
export function InstallmentPreviewCard({ settings }: Props) {
  const [sample, setSample] = useState<number | null>(SAMPLE_AMOUNT);

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-semibold">O que o pagador vê</h2>
      <MoneyInput valueCents={sample} onChange={setSample} />
      {settings && sample !== null && (
        <table className="w-full text-left text-sm" aria-label="Prévia das parcelas">
          <tbody className="divide-y divide-line [&_td]:py-1.5">
            {previewInstallments(sample, settings).map((option) => (
              <tr key={option.count}>
                <td>{`${option.count}x de ${formatBrl(option.installment)}`}</td>
                <td className="text-muted">{option.interestFree ? "sem juros" : "com juros"}</td>
                <td className="text-right">{formatBrl(option.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
