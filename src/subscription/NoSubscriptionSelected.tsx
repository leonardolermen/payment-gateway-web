import { WorkspaceEmpty } from "../support/ui/Workspace";

export function NoSubscriptionSelected() {
  return (
    <WorkspaceEmpty>
      Escolha uma assinatura na lista para ver as faturas, as tentativas e as ações.
    </WorkspaceEmpty>
  );
}
