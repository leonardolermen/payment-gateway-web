import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";
import type { Receipt } from "./checkoutState";

type Props = {
  amount: number | null;
  paidAt: string | null;
  authorizedOnly: boolean;
  receipt?: Receipt;
};

const METHOD_NAMES = { PIX: "Pix", BOLECODE: "Boleto", CARD: "Cartão" } as const;

function receiptLine(receipt: Receipt): string {
  if (receipt.method !== "CARD" || !receipt.last4) {
    return METHOD_NAMES[receipt.method];
  }
  // The acquirer sends "VISA", the card's own detection "visa": the receipt reads "Visa" either way.
  const brand = receipt.brand
    ? receipt.brand.charAt(0).toUpperCase() + receipt.brand.slice(1).toLowerCase()
    : "Cartão";
  const installments =
    receipt.installments && receipt.installments > 1 ? ` · ${receipt.installments}x` : " · à vista";
  return `${brand} final ${receipt.last4}${installments}`;
}

// An uncaptured card is "autorizado": calling it "confirmed" would be a promise the merchant has not
// made. The date is not the signal, because a PAID order loads without one.
export function PaidScreen({ amount, paidAt, authorizedOnly, receipt }: Props) {
  return (
    <section className="text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
        <svg
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h2
        data-step-heading
        tabIndex={-1}
        className="font-display text-xl font-semibold outline-none"
      >
        {authorizedOnly ? "Pagamento autorizado" : "Pagamento confirmado"}
      </h2>
      {amount !== null && (
        // With interest the payer paid more than the order: the receipt shows what left the card.
        <p className="mt-2 font-display text-2xl">
          {formatBrl(amount + (receipt?.interestAmount ?? 0))}
        </p>
      )}
      {receipt && receipt.interestAmount > 0 && amount !== null && (
        <p className="text-xs text-muted">
          {formatBrl(amount)} + {formatBrl(receipt.interestAmount)} de juros do parcelamento
        </p>
      )}
      {receipt && <p className="mt-1 text-sm">{receiptLine(receipt)}</p>}
      {paidAt && <p className="text-sm text-muted">{formatDateTime(paidAt)}</p>}
      <p className="mt-4 text-muted">Você pode fechar esta página.</p>
    </section>
  );
}
