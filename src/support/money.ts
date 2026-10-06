const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBrl(cents: number): string {
  return BRL.format(cents / 100);
}

/**
 * Cents from what a Brazilian types. Done on strings, not numbers: 0.29 * 100 is 28.999… in
 * floating point, and a charge that is one cent short is a dispute.
 *
 * "1.234" is read as one thousand two hundred thirty-four (a pt-BR thousands separator), never
 * as 1.234 reais: a dot followed by exactly three digits is far more likely a thousands mark
 * than a three-decimal amount, which does not exist in BRL.
 */
export function parseBrl(input: string): number | null {
  const cleaned = input.replace(/R\$/g, "").replace(/\s/g, "");
  if (cleaned === "" || /[^0-9.,]/.test(cleaned)) {
    return null;
  }

  const commas = (cleaned.match(/,/g) ?? []).length;
  const dots = (cleaned.match(/\./g) ?? []).length;
  const dotsAreThousands = /^\d{1,3}(\.\d{3})+$/.test(cleaned);
  if (commas > 1 || (commas === 0 && dots > 1 && !dotsAreThousands)) {
    return null;
  }

  let integer: string;
  let fraction: string;
  if (commas === 1) {
    const [left, right] = cleaned.split(",") as [string, string];
    // Dots left of the comma must be thousands groups: "12.34,56" is a typo, not 1234,56.
    if (!/^\d+$/.test(left) && !/^\d{1,3}(\.\d{3})+$/.test(left)) {
      return null;
    }
    integer = left.replace(/\./g, "");
    fraction = right;
  } else if (dots === 1 && !dotsAreThousands) {
    const [left, right] = cleaned.split(".") as [string, string];
    integer = left;
    fraction = right;
  } else {
    integer = cleaned.replace(/\./g, "");
    fraction = "";
  }

  if (!/^\d*$/.test(integer) || !/^\d{0,2}$/.test(fraction)) {
    return null;
  }

  const cents = Number(integer || "0") * 100 + Number((fraction + "00").slice(0, 2));
  return cents > 0 ? cents : null;
}
