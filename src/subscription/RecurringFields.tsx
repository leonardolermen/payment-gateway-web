import { useQuery } from "@tanstack/react-query";
import { formatBrl } from "../support/money";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { cadence, METHOD_NAMES } from "./labels";
import { listActivePlans, subscriptionKeys } from "./subscriptionApi";
import { NEW_PLAN, type PlanChoice } from "./planChoice";
import type { PlanInterval, SubscriptionMethod } from "./types";

type Props = {
  plan: PlanChoice;
  onPlanChange: (plan: PlanChoice) => void;
  method: SubscriptionMethod;
  onMethodChange: (method: SubscriptionMethod) => void;
};

const INTERVALS: { value: PlanInterval; label: string }[] = [
  { value: "DAY", label: "dia(s)" },
  { value: "WEEK", label: "semana(s)" },
  { value: "MONTH", label: "mês(es)" },
  { value: "YEAR", label: "ano(s)" },
];

const METHODS: SubscriptionMethod[] = ["CARD", "PIX", "BOLECODE"];

const METHOD_HINTS: Record<SubscriptionMethod, string> = {
  CARD: "O cliente paga a 1ª cobrança por um link e o cartão fica salvo para as próximas.",
  PIX: "Cada ciclo gera um Pix novo; o link de cada cobrança sai no evento da fatura.",
  BOLECODE: "Cada ciclo gera um boleto que vence no fim do período. Exige endereço do cliente.",
};

/** The recurring half of "Nova cobrança": which plan repeats, and how the customer pays it. */
export function RecurringFields({ plan, onPlanChange, method, onMethodChange }: Props) {
  const plans = useQuery({ queryKey: subscriptionKeys.plans, queryFn: listActivePlans });

  return (
    <div className="space-y-4">
      <Field label="Plano" htmlFor="plan">
        <select
          id="plan"
          value={plan.kind === "existing" ? plan.planId : ""}
          onChange={(event) =>
            onPlanChange(
              event.target.value === ""
                ? NEW_PLAN
                : { kind: "existing", planId: event.target.value },
            )
          }
          className={INPUT_CLASSES}
        >
          <option value="">Novo plano…</option>
          {(plans.data ?? []).map((existing) => (
            <option key={existing.id} value={existing.id}>
              {existing.name} · {formatBrl(existing.amount)} ·{" "}
              {cadence(existing.interval, existing.interval_count)}
            </option>
          ))}
        </select>
      </Field>

      {plan.kind === "new" && (
        <div className="grid grid-cols-[auto_1fr_auto] items-end gap-3">
          <Field label="Repetir a cada" htmlFor="interval-count">
            <input
              id="interval-count"
              type="number"
              min={1}
              max={12}
              value={plan.intervalCount}
              onChange={(event) =>
                onPlanChange({ ...plan, intervalCount: Math.max(1, Number(event.target.value)) })
              }
              className={`${INPUT_CLASSES} w-20`}
            />
          </Field>
          <Field label="Período" htmlFor="interval">
            <select
              id="interval"
              value={plan.interval}
              onChange={(event) =>
                onPlanChange({ ...plan, interval: event.target.value as PlanInterval })
              }
              className={INPUT_CLASSES}
            >
              {INTERVALS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dias de teste" htmlFor="trial-days">
            <input
              id="trial-days"
              type="number"
              min={0}
              max={365}
              value={plan.trialDays}
              onChange={(event) =>
                onPlanChange({ ...plan, trialDays: Math.max(0, Number(event.target.value)) })
              }
              className={`${INPUT_CLASSES} w-24`}
            />
          </Field>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-[10px] font-medium tracking-wider text-muted uppercase">
          Forma de pagamento
        </legend>
        <div className="flex gap-4 text-sm [&_input]:accent-accent">
          {METHODS.map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="subscription-method"
                checked={method === option}
                onChange={() => onMethodChange(option)}
              />{" "}
              {METHOD_NAMES[option]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">{METHOD_HINTS[method]}</p>
      </fieldset>
    </div>
  );
}
