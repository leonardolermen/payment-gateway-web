import type { PlanInterval } from "./types";

export type PlanChoice =
  | { kind: "existing"; planId: string }
  | { kind: "new"; interval: PlanInterval; intervalCount: number; trialDays: number };

export const NEW_PLAN: PlanChoice = {
  kind: "new",
  interval: "MONTH",
  intervalCount: 1,
  trialDays: 0,
};
