export type ProviderId = "ITAU" | "CIELO";

export type ProbeOutcome = {
  ok: boolean;
  detail: string;
  checked_at: string;
};

export type ProviderStatus = {
  provider: ProviderId;
  methods: string[];
  configured: boolean;
  updated_at: string | null;
  fingerprint: string | null;
  secrets_set: Record<string, boolean>;
  last_test: ProbeOutcome | null;
  notification_key_set: boolean | null;
};

export type ProvidersOverview = {
  environment: "TEST" | "LIVE";
  inbound_webhook_url: string | null;
  providers: ProviderStatus[];
};

export type FieldKind = "text" | "secret" | "pem";

export type FieldSpec = {
  name: string;
  label: string;
  kind: FieldKind;
  secret?: boolean;
  liveOnly?: boolean;
  hint?: string;
  defaultValue?: string;
};
