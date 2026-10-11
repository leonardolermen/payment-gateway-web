import { useQueryClient } from "@tanstack/react-query";
import type { Environment } from "../../auth/environment";
import { formatDateTime } from "../../support/dates";
import { Badge, type BadgeTone } from "../../support/ui/Badge";
import { Card } from "../../support/ui/Card";
import { CredentialForm } from "./CredentialForm";
import { NotificationKeyForm } from "./NotificationKeyForm";
import { providerTitle } from "./providerFields";
import { providerKeys } from "./providersApi";
import { TestConnectionButton } from "./TestConnectionButton";
import type { ProviderStatus } from "./types";

type State = { tone: BadgeTone; text: string; detail?: string };

function stateOf(status: ProviderStatus): State {
  const test = status.last_test;

  if (!status.configured) {
    return { tone: "neutral", text: "Não configurado" };
  }

  if (test === null) {
    return { tone: "warn", text: "Configurado, não testado" };
  }

  return test.ok
    ? { tone: "ok", text: `Conectado em ${formatDateTime(test.checked_at)}` }
    : { tone: "danger", text: `Falhou em ${formatDateTime(test.checked_at)}`, detail: test.detail };
}

type Props = { status: ProviderStatus; environment: Environment };

export function ProviderCard({ status, environment }: Props) {
  const queryClient = useQueryClient();
  const state = stateOf(status);

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: providerKeys.overview(environment) });
  }

  return (
    <Card>
      <section className="space-y-4">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{providerTitle(status.provider)}</h3>
            {status.methods.map((method) => (
              <Badge key={method} tone="neutral">
                {method}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={state.tone}>{state.text}</Badge>
            {state.detail && <span className="text-danger">{state.detail}</span>}
            {status.configured && status.updated_at && (
              <span className="text-muted">Atualizado em {formatDateTime(status.updated_at)}</span>
            )}
          </div>
        </header>

        <CredentialForm
          provider={status.provider}
          environment={environment}
          storedFields={status.fields}
          secretsSet={status.secrets_set}
          onSaved={refresh}
        />

        <TestConnectionButton
          provider={status.provider}
          environment={environment}
          configured={status.configured}
        />

        {status.provider === "CIELO" && (
          <NotificationKeyForm
            environment={environment}
            keySet={status.notification_key_set === true}
          />
        )}
      </section>
    </Card>
  );
}
