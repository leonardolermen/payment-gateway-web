import { formatBrl } from "../support/money";
import type { Plan, PlanInterval } from "./types";

const SINGULAR: Record<PlanInterval, string> = {
  DAY: "dia",
  WEEK: "semana",
  MONTH: "mês",
  YEAR: "ano",
};
const PLURAL: Record<PlanInterval, string> = {
  DAY: "dias",
  WEEK: "semanas",
  MONTH: "meses",
  YEAR: "anos",
};

export function priceLabel(plan: Pick<Plan, "amount" | "interval" | "interval_count">): string {
  // Intl separates "R$" from the number with a no-break space; a plain space keeps the label
  // identical to what a merchant would type into a message, as MoneyInput does.
  const price = formatBrl(plan.amount).replace(/\s/g, " ");
  if (plan.interval_count === 1) {
    return `${price} / ${SINGULAR[plan.interval]}`;
  }

  return `${price} a cada ${plan.interval_count} ${PLURAL[plan.interval]}`;
}

export function trialLabel(days: number): string {
  if (days === 0) {
    return "sem trial";
  }

  return days === 1 ? "1 dia" : `${days} dias`;
}
