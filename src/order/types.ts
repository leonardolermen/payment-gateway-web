export type OrderStatus = "OPEN" | "PAID" | "CANCELED" | "EXPIRED";
export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "AUTHORIZED"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELED";
export type PaymentMethod = "PIX" | "BOLECODE" | "CARD";

// Field names mirror the API (snake_case) on purpose: a renaming layer is one more place to drift.
export type Order = {
  id: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  reference: string | null;
  description: string | null;
  customer_id: string | null;
  paid_payment_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  subscription_id: string | null;
  invoice_number: number | null;
  period: { start: string; end: string } | null;
  payments: { id: string; method: PaymentMethod; status: PaymentStatus; created_at: string }[];
  created_at: string;
  checkout_url: string | null;
};

export type Payment = {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  provider: string;
  environment: string;
  amount: number;
  currency: string;
  reference: string | null;
  order_id: string | null;
  description: string | null;
  pix: { txid: string; copia_e_cola: string; location: string; end_to_end_id: string | null } | null;
  boleto: {
    linha_digitavel: string;
    codigo_barras: string;
    due_date: string;
    payment_limit_date: string | null;
    paid_via: string | null;
  } | null;
  card: {
    brand: string;
    last4: string;
    installments: number;
    authorization_code: string | null;
    tid: string | null;
    captured_amount: number | null;
    card_id: string | null;
  } | null;
  expires_at: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  refunded_amount: number | null;
  created_at: string;
};
