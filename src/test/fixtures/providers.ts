import type { ProviderStatus, ProvidersOverview } from "../../settings/providers/types";

export function aProviderStatus(overrides: Partial<ProviderStatus> = {}): ProviderStatus {
  return {
    provider: "ITAU",
    methods: ["PIX", "BOLETO"],
    configured: false,
    updated_at: null,
    fingerprint: null,
    secrets_set: {},
    last_test: null,
    notification_key_set: null,
    fields: {},
    ...overrides,
  };
}

export function anOverview(overrides: Partial<ProvidersOverview> = {}): ProvidersOverview {
  return {
    environment: "TEST",
    inbound_webhook_url: "https://gw.example/webhooks/itau",
    providers: [
      aProviderStatus(),
      aProviderStatus({ provider: "CIELO", methods: ["CARD"], notification_key_set: false }),
    ],
    ...overrides,
  };
}
