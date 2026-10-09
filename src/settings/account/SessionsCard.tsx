import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listSessions, meKeys, revokeOtherSessions } from "../../auth/authApi";
import { ConfirmDialog } from "../../support/ConfirmDialog";
import { formatDateTime } from "../../support/dates";
import { messageFor } from "../../support/gatewayError";
import { Badge } from "../../support/ui/Badge";
import { Button } from "../../support/ui/Button";
import { Card } from "../../support/ui/Card";
import { Table } from "../../support/ui/Table";

const HEADERS = ["Dispositivo", "IP", "Criado em", "Último uso"];

export function SessionsCard() {
  const queryClient = useQueryClient();
  const [isConfirming, setConfirming] = useState(false);
  const sessions = useQuery({ queryKey: meKeys.sessions, queryFn: listSessions });
  const revoke = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meKeys.sessions });
      setConfirming(false);
    },
  });

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">Sessões</h2>
        <Button variant="danger-ghost" size="sm" onClick={() => setConfirming(true)}>
          Encerrar as outras sessões
        </Button>
      </div>

      {sessions.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(sessions.error)}
        </p>
      )}

      <Table headers={HEADERS}>
        {sessions.data?.map((session) => (
          <tr key={session.id}>
            <td>
              <span className="mr-2">{session.user_agent ?? "—"}</span>
              {session.current && <Badge tone="ok">atual</Badge>}
            </td>
            <td>{session.ip ?? "—"}</td>
            <td className="whitespace-nowrap">{formatDateTime(session.created_at)}</td>
            <td className="whitespace-nowrap">{formatDateTime(session.last_used_at)}</td>
          </tr>
        ))}
      </Table>

      {isConfirming && (
        <ConfirmDialog
          title="Encerrar as outras sessões?"
          confirmLabel="Encerrar"
          pending={revoke.isPending}
          error={revoke.isError ? messageFor(revoke.error) : null}
          onConfirm={() => revoke.mutate()}
          onCancel={() => setConfirming(false)}
        >
          <p className="text-sm text-muted">Os outros dispositivos vão precisar entrar de novo.</p>
        </ConfirmDialog>
      )}
    </Card>
  );
}
