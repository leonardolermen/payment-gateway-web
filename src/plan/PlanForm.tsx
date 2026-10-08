import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { TextField } from "../customer/TextField";
import { MoneyInput } from "../order/MoneyInput";
import { messageFor } from "../support/gatewayError";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { Button } from "../support/ui/Button";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { createPlan, planKeys } from "./planApi";
import type { Plan, PlanInterval } from "./types";

type Props = { onCreated: (plan: Plan) => void; onCancel: () => void };

const INTERVALS: { value: PlanInterval; label: string }[] = [
  { value: "DAY", label: "dia(s)" },
  { value: "WEEK", label: "semana(s)" },
  { value: "MONTH", label: "mês(es)" },
  { value: "YEAR", label: "ano(s)" },
];

type Errors = { name?: string; amount?: string; count?: string; trial?: string };

// A dialog, not a page: a plan has five fields and the list is where the merchant came from.
export function PlanForm({ onCreated, onCancel }: Props) {
  const queryClient = useQueryClient();
  const idempotencyKey = useIdempotencyKey();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [interval, setInterval] = useState<PlanInterval>("MONTH");
  const [count, setCount] = useState("1");
  const [trial, setTrial] = useState("0");
  const [errors, setErrors] = useState<Errors>({});

  const create = useMutation({
    mutationFn: (body: Parameters<typeof createPlan>[0]) =>
      createPlan(body, idempotencyKey.current()),
    onSuccess: (plan) => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all });
      idempotencyKey.renew();
      onCreated(plan);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    const countNumber = Number(count);
    const trialNumber = Number(trial);
    const next: Errors = {};
    if (name.trim() === "") {
      next.name = "Informe o nome.";
    }
    if (amount === null) {
      next.amount = "Informe o valor.";
    }
    if (!Number.isInteger(countNumber) || countNumber < 1) {
      next.count = "Pelo menos 1.";
    }
    if (!Number.isInteger(trialNumber) || trialNumber < 0) {
      next.trial = "Zero ou mais dias.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || amount === null) {
      return;
    }

    create.mutate({
      name: name.trim(),
      amount,
      currency: "BRL",
      interval,
      interval_count: countNumber,
      trial_days: trialNumber,
    });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submit}
        // Our own messages, in Portuguese and next to the field: the browser's bubble would
        // block the submit before they could show.
        noValidate
        role="dialog"
        aria-modal="true"
        aria-label="Novo plano"
        className="w-full max-w-md space-y-4 rounded-card border border-line bg-surface p-5 text-ink shadow-xl"
      >
        <h2 className="font-display text-lg font-semibold">Novo plano</h2>
        <TextField
          label="Nome"
          id="plan-name"
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <MoneyInput valueCents={amount} onChange={setAmount} />
        {errors.amount && <p className="text-sm text-danger">{errors.amount}</p>}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="A cada"
            id="plan-count"
            type="number"
            min={1}
            value={count}
            error={errors.count}
            onChange={(event) => setCount(event.target.value)}
          />
          <Field label="Intervalo" htmlFor="plan-interval">
            <select
              id="plan-interval"
              value={interval}
              className={INPUT_CLASSES}
              onChange={(event) => setInterval(event.target.value as PlanInterval)}
            >
              {INTERVALS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <TextField
          label="Dias de trial"
          id="plan-trial"
          type="number"
          min={0}
          value={trial}
          error={errors.trial}
          onChange={(event) => setTrial(event.target.value)}
        />
        <p className="text-xs text-muted">
          Valor e intervalo não mudam depois: para outro preço, crie outro plano.
        </p>
        {create.isError && (
          <p role="alert" className="text-sm text-danger">
            {messageFor(create.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Voltar
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Criar plano
          </Button>
        </div>
      </form>
    </div>
  );
}
