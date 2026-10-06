import { request } from "../support/http";
import { merchantRequest } from "../support/merchantRequest";

export type Merchant = {
  merchant_id: string;
  name: string;
  environment: "TEST" | "LIVE";
};

// With an explicit key (login) it is not stored yet, and a 401 must not trigger the global redirect.
export async function getMerchant(apiKey?: string): Promise<Merchant> {
  const { data } = apiKey
    ? await request<Merchant>("/v1/merchant", { apiKey })
    : await merchantRequest<Merchant>("/v1/merchant");
  return data;
}
