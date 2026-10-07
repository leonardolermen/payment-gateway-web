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
  // interest_amount: what the payer paid above the order, when the installments carried interest.
  // Absent on a gateway before installment settings.
  card: { brand: string; last4: string; installments: number; interest_amount?: number } | null;
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
  // From the gateway's installment settings (spec 2026-10-07 §3). Absent on a gateway that predates
  // them: the form then offers only "à vista" rather than a rule of its own.
  installment_options?: InstallmentOption[];
  // A subscription's first invoice: the card paid here is saved for the next cycles, and the
  // gateway then offers only CARD (gateway spec 2026-10-07-assinatura-por-link §2).
  plan_name?: string | null;
  saves_card_for_subscription?: boolean;
};

export type InstallmentOption = {
  count: number;
  installment_amount: number;
  total: number;
  interest_free: boolean;
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
