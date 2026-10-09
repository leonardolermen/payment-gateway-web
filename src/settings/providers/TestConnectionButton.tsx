import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Environment } from "../../auth/environment";
import { formatDateTime } from "../../support/dates";
import { GatewayRequestError, messageFor } from "../../support/gatewayError";
import { Button } from "../../support/ui/Button";
import { providerKeys, testConnection } from "./providersApi";
import type { ProviderId } from "./types";

// The global PROVIDER_CREDENTIALS_MISSING copy is the checkout's ("método não disponível"); here the
// merchant can act on it, so the panel says what to do instead of changing the checkout wording.
const PANEL_MESSAGES: Record<string, string> = {
  PROVIDER_CREDENTIALS_MISSING: "Configure as credenciais antes de testar.",
};

function testErrorMessage(error: unknown): string {
  const code = error instanceof GatewayRequestError ? error.error.code : "";
  return PANEL_MESSAGES[code] ?? messageFor(error);
}

type Props = { provider: ProviderId; environment: Environment; configured: boolean };

export function TestConnectionButton({ provider, environment, configured }: Props) {
  const queryClient = useQueryClient();
  const test = useMutation({
    mutationFn: () => testConnection(provider),
    // The gateway records every probe, so the card badge follows the latest one either way.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: providerKeys.overview(environment) }),
  });

  const outcome = test.data;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="ghost"
        onClick={() => test.mutate()}
        disabled={!configured || test.isPending}
        title={configured ? undefined : "Salve as credenciais primeiro"}
      >
        Testar conexão
      </Button>

      {outcome && (
        <span className="text-sm">
          <span className={outcome.ok ? "text-ok-fg" : "text-danger"}>
            {outcome.ok ? "✓" : "✕"} {outcome.detail}
          </span>{" "}
          <span className="text-xs text-muted">{formatDateTime(outcome.checked_at)}</span>
        </span>
      )}

      {test.isError && (
        <span role="alert" className="text-sm text-danger">
          {testErrorMessage(test.error)}
        </span>
      )}
    </div>
  );
}
