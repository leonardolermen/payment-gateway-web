import type { InstallmentSettingsInput } from "./types";

export type InstallmentPreview = {
  count: number;
  installment: number;
  total: number;
  interestFree: boolean;
};

// R$ 5,00: the acquirer's minimum per installment, same rule as the gateway.
const MINIMUM_INSTALLMENT_CENTS = 500;

// A whole-cent installment can come out as 1234.000000000001 in doubles, as it does in the
// gateway's DECIMAL64; ceiling that would show a cent nobody will be charged. Round to six
// places first, as the gateway does.
const NOISE_SCALE = 1e6;

/**
 * A copy of the gateway's InstallmentPricing (spec §5): the merchant sees here exactly what the
 * payer will see on the checkout. The test pins it to the gateway's own vectors.
 */
export function previewInstallments(
  amount: number,
  input: InstallmentSettingsInput,
): InstallmentPreview[] {
  const options: InstallmentPreview[] = [];
  for (let count = 1; count <= input.max_installments; count++) {
    const option = price(amount, input, count);
    if (count === 1 || option.installment >= MINIMUM_INSTALLMENT_CENTS) {
      options.push(option);
    }
  }

  return options;
}

function price(amount: number, input: InstallmentSettingsInput, count: number): InstallmentPreview {
  if (count <= input.interest_free_up_to || input.monthly_rate_bps === 0) {
    return { count, installment: Math.floor(amount / count), total: amount, interestFree: true };
  }

  const rate = input.monthly_rate_bps / 10_000;
  const raw = (amount * rate) / (1 - Math.pow(1 + rate, -count));
  const installment = Math.ceil(Math.round(raw * NOISE_SCALE) / NOISE_SCALE);

  return { count, installment, total: installment * count, interestFree: false };
}
