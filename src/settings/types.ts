// Field names mirror the API (snake_case) on purpose, as in order/types.ts.
export type InstallmentSettings = {
  environment: "TEST" | "LIVE";
  max_installments: number;
  interest_free_up_to: number;
  monthly_rate_bps: number;
  updated_at: string;
};

export type InstallmentSettingsInput = {
  max_installments: number;
  interest_free_up_to: number;
  monthly_rate_bps: number;
};
