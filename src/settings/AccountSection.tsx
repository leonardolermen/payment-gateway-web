import { useEnvironment } from "../app/useEnvironment";
import type { Environment } from "../auth/environment";
import { useMe } from "../auth/useMe";
import { Badge, type BadgeTone } from "../support/ui/Badge";
import { Card } from "../support/ui/Card";

const ENVIRONMENT_TONE: Record<Environment, BadgeTone> = { TEST: "warn", LIVE: "ok" };
const ENVIRONMENT_COPY: Record<Environment, string> = {
  TEST: "Você está no ambiente de teste: cobranças feitas aqui não movem dinheiro.",
  LIVE: "Você está em produção: cobranças feitas aqui movem dinheiro de verdade.",
};

// Temporary: Task 5 rewrites this section around the user's own account.
export function AccountSection() {
  const me = useMe();
  const environment = useEnvironment();

  return (
    <Card className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">Loja</dt>
          <dd className="font-medium">{me.data?.merchant.name ?? "…"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">Ambiente</dt>
          <dd className="space-y-1">
            <Badge tone={ENVIRONMENT_TONE[environment]}>{environment}</Badge>
            <p className="text-xs text-muted">{ENVIRONMENT_COPY[environment]}</p>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">E-mail</dt>
          <dd className="text-sm">
            {me.data && (me.data.user.email_verified ? "Confirmado" : "Aguardando confirmação")}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
