import { Badge, type BadgeTone } from "../support/ui/Badge";
import type { OrderStatus, PaymentStatus } from "./types";

const LABELS: Record<OrderStatus | PaymentStatus, string> = {
  OPEN: "Aberta",
  PAID: "Paga",
  CANCELED: "Cancelada",
  EXPIRED: "Expirada",
  CREATED: "Criado",
  PENDING: "Pendente",
  AUTHORIZED: "Autorizado",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
};

// CANCELED/EXPIRED are shared keys but worded differently (feminine vs masculine), so the
// payment context overrides them.
const PAYMENT_LABELS: Partial<Record<PaymentStatus, string>> = {
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
};

const TONES: Record<OrderStatus | PaymentStatus, BadgeTone> = {
  PAID: "ok",
  COMPLETED: "ok",
  OPEN: "warn",
  PENDING: "warn",
  AUTHORIZED: "warn",
  CREATED: "warn",
  CANCELED: "neutral",
  EXPIRED: "neutral",
  FAILED: "danger",
};

type Props = { status: OrderStatus; kind?: "order" } | { status: PaymentStatus; kind: "payment" };

export function StatusBadge(props: Props) {
  const label =
    props.kind === "payment"
      ? (PAYMENT_LABELS[props.status] ?? LABELS[props.status])
      : LABELS[props.status];

  return <Badge tone={TONES[props.status]}>{label}</Badge>;
}
