import type { ReactNode } from "react";
import { useEnvironment } from "../../app/useEnvironment";
import type { Environment } from "../../auth/environment";
import { useMe } from "../../auth/useMe";
import { useResendVerification } from "../../auth/useResendVerification";
import { messageFor } from "../../support/gatewayError";
import { Badge, type BadgeTone } from "../../support/ui/Badge";
import { Button } from "../../support/ui/Button";
import { Card } from "../../support/ui/Card";

const ENVIRONMENT_TONE: Record<Environment, BadgeTone> = { TEST: "warn", LIVE: "ok" };
const ENVIRONMENT_COPY: Record<Environment, string> = {
  TEST: "Você está no ambiente de teste: cobranças feitas aqui não movem dinheiro.",
  LIVE: "Você está em produção: cobranças feitas aqui movem dinheiro de verdade.",
};

function Entry({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium tracking-wider text-muted uppercase">{term}</dt>
      <dd className="space-y-1">{children}</dd>
    </div>
  );
}

export function StoreSection() {
  const me = useMe();
  const environment = useEnvironment();
  const resend = useResendVerification();

  const user = me.data?.user;

  return (
    <Card className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Entry term="Loja">
          <span className="font-medium">{me.data?.merchant.name ?? "…"}</span>
        </Entry>

        <Entry term="Ambiente">
          <Badge tone={ENVIRONMENT_TONE[environment]}>{environment}</Badge>
          <p className="text-xs text-muted">{ENVIRONMENT_COPY[environment]}</p>
        </Entry>

        {user && (
          <Entry term="E-mail">
            <p className="text-sm">{user.email}</p>
            <Badge tone={user.email_verified ? "ok" : "warn"}>
              {user.email_verified ? "Confirmado" : "Aguardando confirmação"}
            </Badge>
            {!user.email_verified && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={resend.send}
                  disabled={resend.status === "pending" || resend.status === "sent"}
                >
                  {resend.status === "sent" ? "Enviado" : "Reenviar e-mail"}
                </Button>
                {resend.status === "error" && (
                  <span role="alert" className="text-sm text-danger">
                    {messageFor(resend.error)}
                  </span>
                )}
              </div>
            )}
          </Entry>
        )}
      </dl>
    </Card>
  );
}
