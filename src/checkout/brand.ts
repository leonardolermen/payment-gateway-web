export type Brand = "visa" | "mastercard" | "amex" | "elo" | "hipercard";

// Order matters: Elo and Hipercard ranges overlap the Visa (4) and Mastercard (5, 6) leading
// digits, so the specific prefixes must be tested before the generic ones. Icon only, never
// used to validate.
const RULES: { brand: Brand; pattern: RegExp }[] = [
  { brand: "hipercard", pattern: /^(606282|3841)/ },
  {
    brand: "elo",
    pattern: /^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/,
  },
  { brand: "amex", pattern: /^3[47]/ },
  { brand: "visa", pattern: /^4/ },
  { brand: "mastercard", pattern: /^(5[1-5]|2(2[2-9]\d|[3-6]\d\d|7[01]\d|720))/ },
];

export function brandOf(digits: string): Brand | null {
  const rule = RULES.find((candidate) => candidate.pattern.test(digits));

  return rule ? rule.brand : null;
}
