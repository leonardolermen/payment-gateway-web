import { merchantRequest } from "../support/merchantRequest";
import type { NewPlan, Plan, PlanPatch } from "./types";

export const planKeys = {
  all: ["plans"] as const,
  list: (active?: boolean) => ["plans", "list", { active }] as const,
  detail: (id: string) => ["plans", id] as const,
};

export async function listPlans(active?: boolean): Promise<Plan[]> {
  const query = active === undefined ? "" : `?active=${active}`;
  const { data } = await merchantRequest<Plan[]>(`/v1/plans${query}`);
  return data;
}

export async function createPlan(body: NewPlan, idempotencyKey: string): Promise<Plan> {
  const { data } = await merchantRequest<Plan>("/v1/plans", {
    method: "POST",
    body,
    idempotencyKey,
  });
  return data;
}

export async function patchPlan(id: string, body: PlanPatch): Promise<Plan> {
  const { data } = await merchantRequest<Plan>(`/v1/plans/${id}`, { method: "PATCH", body });
  return data;
}
