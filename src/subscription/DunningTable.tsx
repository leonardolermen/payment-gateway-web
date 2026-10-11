import { formatDateTime } from "../support/dates";
import { Table } from "../support/ui/Table";
import { DUNNING_OUTCOME } from "./subscriptionLabels";
import type { DunningAttempt } from "./types";

const HEADERS = ["Tentativa", "Agendada", "Rodou", "Resultado"];

export function DunningTable({ dunning }: { dunning: DunningAttempt[] }) {
  return (
    <section aria-labelledby="subscription-dunning-title" className="space-y-2">
      <h2 id="subscription-dunning-title" className="font-display text-sm font-semibold">
        Recobrança
      </h2>

      <Table headers={HEADERS}>
        {dunning.map((attempt) => (
          <tr key={attempt.attempt}>
            <td className="tabular-nums">{attempt.attempt}</td>
            <td className="whitespace-nowrap">{formatDateTime(attempt.scheduled_at)}</td>
            <td className="whitespace-nowrap">
              {attempt.ran_at ? formatDateTime(attempt.ran_at) : "—"}
            </td>
            <td>{attempt.outcome ? DUNNING_OUTCOME[attempt.outcome] : "—"}</td>
          </tr>
        ))}
      </Table>
    </section>
  );
}
