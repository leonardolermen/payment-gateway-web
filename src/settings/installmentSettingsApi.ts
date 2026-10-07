import { merchantRequest } from "../support/merchantRequest";

// Gateway spec 2026-10-07-parcelas-com-juros §2: per environment of the key; no row is the
// default (12 installments, all interest free).
export type InstallmentSettings = {
  max_installments: number;
  interest_free_up_to: number;
  monthly_rate_bps: number;
};

export const installmentSettingsKey = ["installment-settings"] as const;

export async function getInstallmentSettings(): Promise<InstallmentSettings> {
  const { data } = await merchantRequest<InstallmentSettings>("/v1/installment-settings");
  return data;
}

export async function putInstallmentSettings(
  body: InstallmentSettings,
): Promise<InstallmentSettings> {
  const { data } = await merchantRequest<InstallmentSettings>("/v1/installment-settings", {
    method: "PUT",
    body,
  });
  return data;
}
