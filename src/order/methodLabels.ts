import type { PaymentMethod } from "./types";

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "Pix",
  BOLECODE: "Bolecode",
  CARD: "Cartão",
};
