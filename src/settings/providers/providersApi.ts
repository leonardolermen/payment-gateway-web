import type { Environment } from "../../auth/environment";
import { merchantRequest } from "../../support/merchantRequest";
import type { ProbeOutcome, ProviderId, ProvidersOverview } from "./types";

export const providerKeys = {
  overview: (environment: Environment) => ["providers", environment] as const,
};

export async function getProviders(): Promise<ProvidersOverview> {
  const { data } = await merchantRequest<ProvidersOverview>("/v1/merchant/providers");
  return data;
}

export async function putCredentials(
  id: ProviderId,
  payload: Record<string, string>,
): Promise<void> {
  await merchantRequest(`/v1/merchant/providers/${id}/credentials`, {
    method: "PUT",
    body: { payload },
  });
}

export async function testConnection(id: ProviderId): Promise<ProbeOutcome> {
  const { data } = await merchantRequest<ProbeOutcome>(`/v1/merchant/providers/${id}/test`, {
    method: "POST",
  });
  return data;
}

export async function putNotificationKey(key: string): Promise<void> {
  await merchantRequest("/v1/merchant/providers/CIELO/notification-key", {
    method: "PUT",
    body: { key },
  });
}
