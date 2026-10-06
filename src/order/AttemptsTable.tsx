import { formatBrl } from "../support/money";
import { formatDateTime } from "../support/dates";
import { Table } from "../support/ui/Table";
import { StatusBadge } from "./StatusBadge";
import { METHOD_LABELS } from "./methodLabels";
import type { Payment } from "./types";

const HEADERS = ["Método", "Status", "Valor", "Criado em", "Id"];

export function AttemptsTable({ attempts }: { attempts: Payment[] }) {
  if (attempts.length === 0) {
    return <p className="text-sm text-muted">Nenhuma tentativa de pagamento ainda.</p>;
  }

  return (
    <Table headers={HEADERS}>
      {attempts.map((attempt) => (
        <tr key={attempt.id}>
          <td>{METHOD_LABELS[attempt.method]}</td>
          <td>
            <StatusBadge status={attempt.status} kind="payment" />
          </td>
          <td className="whitespace-nowrap">{formatBrl(attempt.amount)}</td>
          <td className="whitespace-nowrap text-muted">{formatDateTime(attempt.created_at)}</td>
          <td className="font-mono text-xs text-muted">{attempt.id}</td>
        </tr>
      ))}
    </Table>
  );
}
