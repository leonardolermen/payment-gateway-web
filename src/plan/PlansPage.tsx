import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCan } from "../auth/useCan";
import { formatDateTime } from "../support/dates";
import { messageFor } from "../support/gatewayError";
import { Badge } from "../support/ui/Badge";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { PageHeader } from "../support/ui/PageHeader";
import { Table } from "../support/ui/Table";
import { EditPlanDialog } from "./EditPlanDialog";
import { listPlans, planKeys } from "./planApi";
import { PlanForm } from "./PlanForm";
import { priceLabel, trialLabel } from "./planLabels";
import type { Plan } from "./types";

const HEADERS = ["Nome", "Preço", "Trial", "Status", "Criado em", ""];

export function PlansPage() {
  const mayCreatePlan = useCan("create_plan");
  const mayEditPlan = useCan("edit_plan");
  const [activeOnly, setActiveOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const active = activeOnly ? true : undefined;
  const plans = useQuery({ queryKey: planKeys.list(active), queryFn: () => listPlans(active) });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Planos"
        action={
          mayCreatePlan ? (
            <Button onClick={() => setCreating(true)}>
              <span aria-hidden="true">+</span>Novo plano
            </Button>
          ) : undefined
        }
      />

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={activeOnly}
          onChange={(event) => setActiveOnly(event.target.checked)}
        />
        Só ativos
      </label>

      {plans.isError && (
        <p role="alert" className="text-danger">
          {messageFor(plans.error)}
        </p>
      )}

      <Card className="p-0 sm:p-2">
        <Table headers={HEADERS}>
          {(plans.data ?? []).map((plan) => (
            <tr key={plan.id} className="hover:bg-surface-muted">
              <td className="font-medium">{plan.name}</td>
              <td className="whitespace-nowrap">{priceLabel(plan)}</td>
              <td className="whitespace-nowrap text-muted">{trialLabel(plan.trial_days)}</td>
              <td>
                <Badge tone={plan.active ? "ok" : "neutral"}>
                  {plan.active ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td className="whitespace-nowrap text-muted">{formatDateTime(plan.created_at)}</td>
              <td className="text-right">
                {mayEditPlan && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar ${plan.name}`}
                    onClick={() => setEditing(plan)}
                  >
                    Editar
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {plans.isSuccess && plans.data.length === 0 && (
        <p className="text-center text-muted">Nenhum plano por aqui.</p>
      )}

      {creating && (
        <PlanForm onCreated={() => setCreating(false)} onCancel={() => setCreating(false)} />
      )}
      {editing && <EditPlanDialog plan={editing} onDone={() => setEditing(null)} />}
    </section>
  );
}
