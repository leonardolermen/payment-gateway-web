import { useQuery } from "@tanstack/react-query";
import { getTeam, meKeys } from "../../auth/authApi";
import { roleLabel } from "../../auth/roleLabels";
import { useMe } from "../../auth/useMe";
import { formatDateTime } from "../../support/dates";
import { messageFor } from "../../support/gatewayError";
import { Card } from "../../support/ui/Card";
import { Table } from "../../support/ui/Table";
import { InviteForm } from "./InviteForm";
import { MembersTable } from "./MembersTable";

const INVITE_HEADERS = ["E-mail", "Papel", "Expira em"];

export function TeamSection() {
  const me = useMe();
  const team = useQuery({ queryKey: meKeys.team, queryFn: getTeam });

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-display text-base font-semibold">Equipe</h2>
        {team.isError && (
          <p role="alert" className="text-sm text-danger">
            {messageFor(team.error)}
          </p>
        )}
        {team.data && me.data && <MembersTable members={team.data.users} ownId={me.data.user.id} />}
      </Card>

      {team.data && team.data.invites.length > 0 && (
        <Card className="space-y-3">
          <h2 className="font-display text-base font-semibold">Convites pendentes</h2>
          <Table headers={INVITE_HEADERS}>
            {team.data.invites.map((pending) => (
              <tr key={pending.email}>
                <td>{pending.email}</td>
                <td>{roleLabel(pending.role)}</td>
                <td className="whitespace-nowrap">{formatDateTime(pending.expires_at)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card>
        <InviteForm />
      </Card>
    </div>
  );
}
