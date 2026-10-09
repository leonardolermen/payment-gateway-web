import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { changeRole, meKeys, removeUser } from "../../auth/authApi";
import type { Role, TeamMember } from "../../auth/types";
import { ConfirmDialog } from "../../support/ConfirmDialog";
import { formatDateTime } from "../../support/dates";
import { messageFor } from "../../support/gatewayError";
import { Button } from "../../support/ui/Button";
import { Table } from "../../support/ui/Table";
import { RoleSelect } from "./RoleSelect";

const HEADERS = ["Nome", "E-mail", "Papel", "Último acesso", ""];

type Props = { members: TeamMember[]; ownId: string };

export function MembersTable({ members, ownId }: Props) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const refreshTeam = () => queryClient.invalidateQueries({ queryKey: meKeys.team });

  const roleChange = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => changeRole(id, role),
    onSettled: refreshTeam,
  });
  const removal = useMutation({
    mutationFn: removeUser,
    onSuccess: async () => {
      await refreshTeam();
      setRemoving(null);
    },
  });

  return (
    <div className="space-y-3">
      {roleChange.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(roleChange.error)}
        </p>
      )}

      <Table headers={HEADERS}>
        {members.map((member) => {
          const isOwn = member.id === ownId;

          return (
            <tr key={member.id}>
              <td className="font-medium">{member.name}</td>
              <td>{member.email}</td>
              <td>
                <RoleSelect
                  aria-label={`Papel de ${member.name}`}
                  value={member.role}
                  disabled={isOwn || roleChange.isPending}
                  title={isOwn ? "Use Minha conta para a sua própria conta" : undefined}
                  onChange={(role) => roleChange.mutate({ id: member.id, role })}
                  className="w-auto"
                />
              </td>
              <td className="whitespace-nowrap">
                {member.last_login_at ? formatDateTime(member.last_login_at) : "—"}
              </td>
              <td>
                {!isOwn && (
                  <Button variant="danger-ghost" size="sm" onClick={() => setRemoving(member)}>
                    Remover
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      {removing && (
        <ConfirmDialog
          title={`Remover ${removing.name}?`}
          confirmLabel="Remover"
          pending={removal.isPending}
          error={removal.isError ? messageFor(removal.error) : null}
          onConfirm={() => removal.mutate(removing.id)}
          onCancel={() => setRemoving(null)}
        >
          <p className="text-sm text-muted">
            {removing.name} ({removing.email}) perde o acesso ao painel na hora.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
