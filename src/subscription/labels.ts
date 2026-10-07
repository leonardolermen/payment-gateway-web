import type { BadgeTone } from "../support/ui/Badge";
import type { PlanInterval, SubscriptionMethod, SubscriptionStatus } from "./types";

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  INCOMPLETE: "Aguardando 1º pagamento",
  INCOMPLETE_EXPIRED: "Não iniciada",
  ACTIVE: "Ativa",
  PAST_DUE: "Inadimplente",
  CANCELED: "Cancelada",
  ENDED: "Encerrada",
};

export const STATUS_TONES: Record<SubscriptionStatus, BadgeTone> = {
  INCOMPLETE: "warn",
  INCOMPLETE_EXPIRED: "neutral",
  ACTIVE: "ok",
  PAST_DUE: "danger",
  CANCELED: "neutral",
  ENDED: "neutral",
};

export const METHOD_NAMES: Record<SubscriptionMethod, string> = {
  CARD: "Cartão",
  PIX: "Pix",
  BOLECODE: "Boleto",
};

const UNITS: Record<PlanInterval, [string, string]> = {
  DAY: ["dia", "dias"],
  WEEK: ["semana", "semanas"],
  MONTH: ["mês", "meses"],
  YEAR: ["ano", "anos"],
};

const ADVERBS: Partial<Record<PlanInterval, string>> = {
  DAY: "diário",
  WEEK: "semanal",
  MONTH: "mensal",
  YEAR: "anual",
};

/** "mensal", "a cada 3 meses". */
export function cadence(interval: PlanInterval, count: number): string {
  if (count === 1) {
    return ADVERBS[interval] ?? UNITS[interval][0];
  }
  return `a cada ${count} ${UNITS[interval][1]}`;
}
