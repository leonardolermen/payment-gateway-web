export type Method = "PIX" | "BOLECODE" | "CARD";

export type CheckoutStatus = "OPEN" | "PAID" | "CANCELED" | "EXPIRED";

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "AUTHORIZED"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELED";

export type CheckoutPayment = {
  id: string;
  method: Method;
  status: PaymentStatus;
  pix: { copia_e_cola: string; expires_at: string | null } | null;
  boleto: { linha_digitavel: string; due_date: string; payment_limit_date: string } | null;
  card: { brand: string; last4: string; installments: number } | null;
  paid_at: string | null;
  created_at: string;
};

export type Checkout = {
  order_id: string;
  merchant_name: string;
  amount: number;
  currency: string;
  description: string;
  status: CheckoutStatus;
  expires_at: string;
  methods: Method[];
  active_payment: CheckoutPayment | null;
};

// Card data only exists in this request body; the reducer never sees it.
export type AttemptBody =
  | { method: "PIX"; expires_in?: number }
  | { method: "BOLECODE" }
  | {
      method: "CARD";
      card: { number: string; holder: string; expiry: string; cvv: string };
      installments?: number;
    };
