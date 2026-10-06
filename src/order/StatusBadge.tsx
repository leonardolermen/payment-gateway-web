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

const TONES: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  COMPLETED: "bg-green-100 text-green-800",
  AUTHORIZED: "bg-blue-100 text-blue-800",
  OPEN: "bg-blue-100 text-blue-800",
  PENDING: "bg-amber-100 text-amber-800",
  CREATED: "bg-gray-100 text-gray-700",
  FAILED: "bg-red-100 text-red-800",
};

type Props =
  | { status: OrderStatus; kind?: "order" }
  | { status: PaymentStatus; kind: "payment" };

export function StatusBadge(props: Props) {
  const label =
    props.kind === "payment"
      ? (PAYMENT_LABELS[props.status] ?? LABELS[props.status])
      : LABELS[props.status];
  const tone = TONES[props.status] ?? "bg-gray-100 text-gray-700";

  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}
