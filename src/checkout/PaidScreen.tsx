import { formatDateTime } from "../support/dates";
import { formatBrl } from "../support/money";

type Props = { amount: number | null; paidAt: string | null };

// No paidAt means the money is authorized but not yet captured; calling it "confirmed" would be a
// promise the merchant has not made.
export function PaidScreen({ amount, paidAt }: Props) {
  return (
    <section>
      <h2 className="text-lg font-semibold">
        {paidAt ? "Pagamento confirmado" : "Pagamento autorizado"}
      </h2>
      {amount !== null && <p>{formatBrl(amount)}</p>}
      {paidAt && <p>{formatDateTime(paidAt)}</p>}
      <p className="mt-2 text-gray-600">Você pode fechar esta página.</p>
    </section>
  );
}
