import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";

type Props = { amount: number | null; paidAt: string | null; authorizedOnly: boolean };

// An uncaptured card is "autorizado": calling it "confirmed" would be a promise the merchant has not
// made. The date is not the signal, because a PAID order loads without one.
export function PaidScreen({ amount, paidAt, authorizedOnly }: Props) {
  return (
    <section>
      <h2 className="text-lg font-semibold">
        {authorizedOnly ? "Pagamento autorizado" : "Pagamento confirmado"}
      </h2>
      {amount !== null && <p>{formatBrl(amount)}</p>}
      {paidAt && <p>{formatDateTime(paidAt)}</p>}
      <p className="mt-2 text-gray-600">Você pode fechar esta página.</p>
    </section>
  );
}
