import type { Step } from "./checkoutState";

const STAGES = ["Forma de pagamento", "Dados", "Confirmação"] as const;

function stageOf(step: Step): number {
  if (step === "metodo") {
    return 0;
  }
  return step === "confirmacao" ? 2 : 1;
}

export function StepIndicator({ step }: { step: Step }) {
  const current = stageOf(step);

  return (
    <ol
      aria-label="Etapas do pagamento"
      className="mb-5 flex items-center gap-2 text-[11px] text-muted"
    >
      {STAGES.map((stage, index) => (
        <li key={stage} className="flex items-center gap-2">
          <span
            aria-current={index === current ? "step" : undefined}
            className={
              index === current ? "font-semibold text-accent" : index < current ? "text-ink" : ""
            }
          >
            {stage}
          </span>
          {index < STAGES.length - 1 && <span aria-hidden="true">›</span>}
        </li>
      ))}
    </ol>
  );
}
