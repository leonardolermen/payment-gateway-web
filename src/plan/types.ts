export type PlanInterval = "DAY" | "WEEK" | "MONTH" | "YEAR";

// Field names mirror the API (snake_case) on purpose, as in order/types.ts.
export type Plan = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: PlanInterval;
  interval_count: number;
  trial_days: number;
  active: boolean;
  created_at: string;
};

export type NewPlan = {
  name: string;
  amount: number;
  currency: "BRL";
  interval: PlanInterval;
  interval_count: number;
  trial_days: number;
};

// Only these two change after creation; the gateway answers PLAN_IMMUTABLE to anything else.
export type PlanPatch = { name?: string; active?: boolean };
