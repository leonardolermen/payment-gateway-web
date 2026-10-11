import { useQuery } from "@tanstack/react-query";
import { useEnvironment } from "../../app/useEnvironment";
import { messageFor } from "../../support/gatewayError";
import { ProviderCard } from "./ProviderCard";
import { getProviders, providerKeys } from "./providersApi";
import { WebhookUrlCard } from "./WebhookUrlCard";

export function ProvidersSection() {
  const environment = useEnvironment();
  const overview = useQuery({
    queryKey: providerKeys.overview(environment),
    queryFn: getProviders,
  });

  if (overview.isPending) {
    return <p className="text-sm text-muted">Carregando…</p>;
  }

  if (overview.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {messageFor(overview.error)}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <WebhookUrlCard url={overview.data.inbound_webhook_url} />
      {/* Keyed by environment: a TEST draft must never be submitted as LIVE credentials. */}
      <div key={environment} className="space-y-4">
        {overview.data.providers.map((status) => (
          <ProviderCard key={status.provider} status={status} environment={environment} />
        ))}
      </div>
    </div>
  );
}
