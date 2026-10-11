import type { Plan } from "../../plan/types";

export function aPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "plan_00000001",
    name: "Mensal Pro",
    amount: 4990,
    currency: "BRL",
    interval: "MONTH",
    interval_count: 1,
    trial_days: 0,
    active: true,
    created_at: "2026-10-01T12:00:00Z",
    ...overrides,
  };
}
