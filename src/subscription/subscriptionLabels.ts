import type { BadgeTone } from "../support/ui/Badge";
import type { SubscriptionStatus } from "./types";

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Ativa", tone: "ok" },
  PAST_DUE: { label: "Em atraso", tone: "warn" },
  INCOMPLETE: { label: "Incompleta", tone: "neutral" },
  INCOMPLETE_EXPIRED: { label: "Expirada", tone: "neutral" },
  CANCELED: { label: "Cancelada", tone: "neutral" },
  ENDED: { label: "Encerrada", tone: "neutral" },
};
