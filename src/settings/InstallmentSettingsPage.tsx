import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { PageHeader } from "../support/ui/PageHeader";
import {
  getInstallmentSettings,
  installmentSettingsKey,
  putInstallmentSettings,
  type InstallmentSettings,
} from "./installmentSettingsApi";

const COUNTS = Array.from({ length: 12 }, (_, index) => index + 1);

// "2,99" is what a merchant types; the gateway wants basis points (299).
function percentToBps(text: string): number | null {
  const value = Number(text.replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 10) {
    return null;
  }
  return Math.round(value * 100);
}

function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2).replace(".", ",");
}

export function InstallmentSettingsPage() {
  const settings = useQuery({ queryKey: installmentSettingsKey, queryFn: getInstallmentSettings });

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Parcelamento" />
      <p className="text-sm text-muted">
        Vale para o ambiente da chave usada no login. O pagador vê o valor de cada parcela antes de
        pagar; acima do limite sem juros, o gateway calcula pela Tabela Price.
      </p>
      {settings.isError && (
        <p role="alert" className="text-danger">
          Não foi possível carregar a configuração.
        </p>
      )}
      {settings.data && <SettingsForm initial={settings.data} />}
    </section>
  );
}

function SettingsForm({ initial }: { initial: InstallmentSettings }) {
  const queryClient = useQueryClient();
  const [max, setMax] = useState(initial.max_installments);
  const [interestFreeUpTo, setInterestFreeUpTo] = useState(initial.interest_free_up_to);
  const [rate, setRate] = useState(bpsToPercent(initial.monthly_rate_bps));
  const [rateError, setRateError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: putInstallmentSettings,
    onSuccess: (saved) => queryClient.setQueryData(installmentSettingsKey, saved),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const bps = percentToBps(rate);
    setRateError(bps === null ? "Informe uma taxa entre 0 e 10% ao mês." : null);
    if (bps === null) {
      return;
    }
    save.mutate({
      max_installments: max,
      interest_free_up_to: Math.min(interestFreeUpTo, max),
      monthly_rate_bps: bps,
    });
  }

  const allFree = interestFreeUpTo >= max;

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Máximo de parcelas" htmlFor="max-installments">
          <select
            id="max-installments"
            value={max}
            onChange={(event) => setMax(Number(event.target.value))}
            className={INPUT_CLASSES}
          >
            {COUNTS.map((count) => (
              <option key={count} value={count}>
                {count === 1 ? "Só à vista" : `Até ${count}x`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sem juros até" htmlFor="interest-free-up-to">
          <select
            id="interest-free-up-to"
            value={Math.min(interestFreeUpTo, max)}
            onChange={(event) => setInterestFreeUpTo(Number(event.target.value))}
            className={INPUT_CLASSES}
          >
            {COUNTS.filter((count) => count <= max).map((count) => (
              <option key={count} value={count}>
                {count}x
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Juros ao mês (%)"
          htmlFor="monthly-rate"
          hint={allFree ? "Sem efeito: todas as parcelas são sem juros." : undefined}
          error={rateError ?? undefined}
          errorId="monthly-rate-error"
        >
          <input
            id="monthly-rate"
            inputMode="decimal"
            value={rate}
            disabled={allFree}
            onChange={(event) => setRate(event.target.value)}
            aria-invalid={rateError ? true : undefined}
            aria-describedby={rateError ? "monthly-rate-error" : undefined}
            className={INPUT_CLASSES}
          />
        </Field>

        {save.isError && (
          <p role="alert" className="text-sm text-danger">
            {messageFor(save.error)}
          </p>
        )}
        {save.isSuccess && <p className="text-sm text-ok-fg">Configuração salva.</p>}

        <Button type="submit" disabled={save.isPending}>
          Salvar
        </Button>
      </form>
    </Card>
  );
}
