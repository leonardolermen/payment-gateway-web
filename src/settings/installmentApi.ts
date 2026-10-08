import { merchantRequest } from "../support/merchantRequest";
import type { InstallmentSettings, InstallmentSettingsInput } from "./types";

export const settingsKeys = {
  installments: ["settings", "installments"] as const,
};

export async function getInstallmentSettings(): Promise<InstallmentSettings> {
  const { data } = await merchantRequest<InstallmentSettings>("/v1/installment-settings");
  return data;
}

export async function putInstallmentSettings(
  input: InstallmentSettingsInput,
): Promise<InstallmentSettings> {
  const { data } = await merchantRequest<InstallmentSettings>("/v1/installment-settings", {
    method: "PUT",
    body: input,
  });
  return data;
}

// The screen speaks "2,99%", the API speaks 299 bps. Done on strings: 2.99 * 100 is 298.99999…
// in floating point, and a rate one bps short is a price the merchant did not set.
export function percentToBps(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) {
    return null;
  }

  const [, whole, fraction = ""] = match;
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

export function bpsToPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const fraction = String(bps % 100).padStart(2, "0");
  return `${whole},${fraction}`;
}
