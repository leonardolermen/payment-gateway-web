import { formatBrl } from "../support/money";
import { formatDateTime } from "../support/dates";
import { StatusBadge } from "./StatusBadge";
import { METHOD_LABELS } from "./methodLabels";
import type { Payment } from "./types";

export function AttemptsTable({ attempts }: { attempts: Payment[] }) {
  if (attempts.length === 0) {
    return <p className="text-sm text-gray-500">Nenhuma tentativa de pagamento ainda.</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-gray-500">
        <tr>
          <th className="py-2">Método</th>
          <th>Status</th>
          <th>Valor</th>
          <th>Criado em</th>
          <th>Id</th>
        </tr>
      </thead>
      <tbody>
        {attempts.map((attempt) => (
          <tr key={attempt.id} className="border-t">
            <td className="py-2">{METHOD_LABELS[attempt.method]}</td>
            <td>
              <StatusBadge status={attempt.status} kind="payment" />
            </td>
            <td>{formatBrl(attempt.amount)}</td>
            <td>{formatDateTime(attempt.created_at)}</td>
            <td className="font-mono text-xs">{attempt.id}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
