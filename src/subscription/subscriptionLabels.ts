import type { BadgeTone } from "../support/ui/Badge";
import type { DunningOutcome, SubscriptionStatus } from "./types";

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Ativa", tone: "ok" },
  PAST_DUE: { label: "Em atraso", tone: "warn" },
  INCOMPLETE: { label: "Incompleta", tone: "neutral" },
  INCOMPLETE_EXPIRED: { label: "Expirada", tone: "neutral" },
  CANCELED: { label: "Cancelada", tone: "neutral" },
  ENDED: { label: "Encerrada", tone: "neutral" },
};

export const DUNNING_OUTCOME: Record<DunningOutcome, string> = {
  PAID: "Paga",
  DECLINED: "Recusada",
  ISSUED: "Emitida",
  EXPIRED: "Expirada",
  SKIPPED: "Dispensada",
};
