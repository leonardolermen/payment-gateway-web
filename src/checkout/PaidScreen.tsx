import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";

type Props = { amount: number | null; paidAt: string | null; authorizedOnly: boolean };

// An uncaptured card is "autorizado": calling it "confirmed" would be a promise the merchant has not
// made. The date is not the signal, because a PAID order loads without one.
export function PaidScreen({ amount, paidAt, authorizedOnly }: Props) {
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
      <h2 className="font-display text-xl font-semibold">
        {authorizedOnly ? "Pagamento autorizado" : "Pagamento confirmado"}
      </h2>
      {amount !== null && <p className="mt-2 font-display text-2xl">{formatBrl(amount)}</p>}
      {paidAt && <p className="text-sm text-muted">{formatDateTime(paidAt)}</p>}
      <p className="mt-4 text-muted">Você pode fechar esta página.</p>
    </section>
  );
}
