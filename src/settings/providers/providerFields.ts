import type { Environment } from "../../auth/environment";
import type { FieldSpec, ProviderId } from "./types";

export const PROVIDER_FIELDS: Record<ProviderId, FieldSpec[]> = {
  ITAU: [
    { name: "client_id", label: "Client ID", kind: "text" },
    { name: "client_secret", label: "Client secret", kind: "secret" },
    { name: "pix_key", label: "Chave Pix recebedora", kind: "text" },
    { name: "beneficiary_id", label: "ID do beneficiário (boleto)", kind: "text" },
    { name: "wallet_code", label: "Carteira", kind: "text", defaultValue: "109" },
    { name: "species_code", label: "Espécie", kind: "text", defaultValue: "01" },
    { name: "x_itau_apikey", label: "x-itau-apikey", kind: "secret", liveOnly: true },
    { name: "certificate_pem", label: "Certificado (.pem)", kind: "pem", liveOnly: true },
    {
      name: "private_key_pem",
      label: "Chave privada (.pem)",
      kind: "pem",
      secret: true,
      liveOnly: true,
    },
  ],
  CIELO: [
    { name: "merchant_id", label: "Merchant ID", kind: "text" },
    { name: "merchant_key", label: "Merchant key", kind: "secret" },
  ],
};

const TITLES: Record<ProviderId, string> = {
  ITAU: "Pix e boleto · Itaú",
  CIELO: "Cartão · Cielo",
};

export function providerTitle(id: ProviderId): string {
  return TITLES[id];
}

export function fieldsFor(id: ProviderId, environment: Environment): FieldSpec[] {
  return PROVIDER_FIELDS[id].filter((spec) => environment === "LIVE" || !spec.liveOnly);
}

export function isSecret(spec: FieldSpec): boolean {
  return spec.kind === "secret" || spec.secret === true;
}

// Must equal the gateway's list of write-only names: a secret the panel does not know about would be
// echoed back into a form field.
export function secretNames(id: ProviderId): string[] {
  return PROVIDER_FIELDS[id].filter(isSecret).map((spec) => spec.name);
}
