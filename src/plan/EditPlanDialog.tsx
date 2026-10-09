import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { TextField } from "../customer/TextField";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { patchPlan, planKeys } from "./planApi";
import type { Plan } from "./types";

type Props = { plan: Plan; onDone: () => void };

// Only name and active: the gateway refuses the rest (PLAN_IMMUTABLE) and the form never offers it.
export function EditPlanDialog({ plan, onDone }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(plan.name);
  const [active, setActive] = useState(plan.active);
  const [nameError, setNameError] = useState<string | undefined>();

  const save = useMutation({
    mutationFn: () => patchPlan(plan.id, { name: name.trim(), active }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all });
      onDone();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    if (name.trim() === "") {
      setNameError("Informe o nome.");
      return;
    }
    setNameError(undefined);

    save.mutate();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Editar plano"
        className="w-full max-w-md space-y-4 rounded-card border border-line bg-surface p-5 text-ink shadow-xl"
      >
        <h2 className="font-display text-lg font-semibold">Editar plano</h2>
        <TextField
          label="Nome"
          id="edit-plan-name"
          value={name}
          error={nameError}
          onChange={(event) => setName(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Ativo
        </label>
        <p className="text-xs text-muted">
          Desativar esconde o plano de novas assinaturas e não cancela assinaturas existentes. Valor
          e intervalo não mudam: para outro preço, crie outro plano.
        </p>
        {save.isError && (
          <p role="alert" className="text-sm text-danger">
            {messageFor(save.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>
            Voltar
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
