import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { TextField } from "../customer/TextField";
import { formatDateTime } from "../support/dates";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import {
  bpsToPercent,
  getInstallmentSettings,
  percentToBps,
  putInstallmentSettings,
  settingsKeys,
} from "./installmentApi";
import { InstallmentPreviewCard } from "./InstallmentPreviewCard";
import type { InstallmentSettings, InstallmentSettingsInput } from "./types";

// The gateway's own ceilings (InstallmentSettings): 12 installments, 10% a month.
const MAX_CEILING = 12;
const MAX_RATE_BPS = 1000;

type Errors = { max?: string; freeUpTo?: string; rate?: string };

function parseInput(max: string, freeUpTo: string, rate: string): InstallmentSettingsInput | null {
  const maxNumber = Number(max);
  const freeUpToNumber = Number(freeUpTo);
  const bps = percentToBps(rate);
  if (!Number.isInteger(maxNumber) || maxNumber < 1 || !Number.isInteger(freeUpToNumber)) {
    return null;
  }
  if (bps === null) {
    return null;
  }

  return { max_installments: maxNumber, interest_free_up_to: freeUpToNumber, monthly_rate_bps: bps };
}

function validate(max: string, freeUpTo: string, rate: string): Errors {
  const maxNumber = Number(max);
  const freeUpToNumber = Number(freeUpTo);
  const bps = percentToBps(rate);
  const errors: Errors = {};

  if (!Number.isInteger(maxNumber) || maxNumber < 1 || maxNumber > MAX_CEILING) {
    errors.max = `Entre 1 e ${MAX_CEILING}.`;
  }
  if (!Number.isInteger(freeUpToNumber) || freeUpToNumber < 1) {
    errors.freeUpTo = "Pelo menos 1.";
  } else if (freeUpToNumber > maxNumber) {
    errors.freeUpTo = "Não pode passar do máximo de parcelas.";
  }
  if (bps === null || bps > MAX_RATE_BPS) {
    errors.rate = "Entre 0,00 e 10,00.";
  }

  return errors;
}

// Loads first, edits after: the editor is mounted with the server's values as its initial state,
// so nothing the merchant types is ever overwritten by a late response.
export function InstallmentSettingsForm() {
  const settings = useQuery({
    queryKey: settingsKeys.installments,
    queryFn: getInstallmentSettings,
  });

  if (settings.isError) {
    return (
      <p role="alert" className="text-danger">
        {messageFor(settings.error)}
      </p>
    );
  }
  if (!settings.data) {
    return <p className="text-sm text-muted">Carregando…</p>;
  }

  return <InstallmentSettingsEditor initial={settings.data} />;
}

function InstallmentSettingsEditor({ initial }: { initial: InstallmentSettings }) {
  const queryClient = useQueryClient();
  const [max, setMax] = useState(String(initial.max_installments));
  const [freeUpTo, setFreeUpTo] = useState(String(initial.interest_free_up_to));
  const [rate, setRate] = useState(bpsToPercent(initial.monthly_rate_bps));
  const [errors, setErrors] = useState<Errors>({});

  const save = useMutation({
    mutationFn: putInstallmentSettings,
    onSuccess: (saved) => queryClient.setQueryData(settingsKeys.installments, saved),
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    const next = validate(max, freeUpTo, rate);
    setErrors(next);
    const input = parseInput(max, freeUpTo, rate);
    if (Object.keys(next).length > 0 || input === null) {
      return;
    }

    save.mutate(input);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <TextField
            label="Máximo de parcelas"
            id="max-installments"
            type="number"
            min={1}
            max={MAX_CEILING}
            value={max}
            error={errors.max}
            onChange={(event) => setMax(event.target.value)}
          />
          <TextField
            label="Sem juros até"
            id="interest-free-up-to"
            type="number"
            min={1}
            value={freeUpTo}
            error={errors.freeUpTo}
            onChange={(event) => setFreeUpTo(event.target.value)}
          />
          <TextField
            label="Juros ao mês (%)"
            id="monthly-rate"
            inputMode="decimal"
            value={rate}
            error={errors.rate}
            onChange={(event) => setRate(event.target.value)}
          />
          {save.isError && (
            <p role="alert" className="text-sm text-danger">
              {messageFor(save.error)}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={save.isPending}>
              Salvar
            </Button>
            {save.isSuccess && (
              <span className="text-xs text-muted">
                Salvo em {formatDateTime(save.data.updated_at)}
              </span>
            )}
          </div>
        </form>
      </Card>

      <InstallmentPreviewCard settings={parseInput(max, freeUpTo, rate)} />
    </div>
  );
}
