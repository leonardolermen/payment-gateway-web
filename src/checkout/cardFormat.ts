import type { Brand } from "./brand";

// Amex prints 15 digits as 4-6-5 and asks for a 4-digit code on the front; every other brand here
// prints up to 19 digits in fours with a 3-digit code on the back.
export function maxDigits(brand: Brand | null): number {
  return brand === "amex" ? 15 : 19;
}

export function cvvLength(brand: Brand | null): number {
  return brand === "amex" ? 4 : 3;
}

/** Groups any characters, so the preview can group "4024 00••" the same way as the field. */
export function groupDigits(chars: string, brand: Brand | null): string {
  if (brand === "amex") {
    return [chars.slice(0, 4), chars.slice(4, 10), chars.slice(10, 15)]
      .filter((part) => part !== "")
      .join(" ");
  }

  return chars.replace(/(.{4})(?=.)/g, "$1 ");
}

export function digitsOf(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

export function formatExpiry(value: string): string {
  const digits = digitsOf(value, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/**
 * Null when MM/AA is a real month not yet over. A card is valid through the last day of its month,
 * so 10/26 still pays on 31/10/2026.
 */
export function expiryError(expiry: string, now: Date): string | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) {
    return "Informe a validade como MM/AA.";
  }

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) {
    return "Mês de validade inválido.";
  }

  const current = now.getFullYear() * 12 + now.getMonth();
  if (year * 12 + (month - 1) < current) {
    return "Cartão vencido.";
  }

  return null;
}

/** The field takes the MM/AA printed on the card; the API (and the Cielo) want MM/YYYY. */
export function toApiExpiry(expiry: string): string {
  const [month, year] = expiry.split("/");
  return `${month}/20${year}`;
}
