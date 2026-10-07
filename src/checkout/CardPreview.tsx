import type { Brand } from "./brand";
import { groupDigits } from "./cardFormat";

type Props = {
  digits: string;
  holder: string;
  expiry: string;
  cvvLength: number;
  cvvTyped: number;
  brand: Brand | null;
  flipped: boolean;
};

const BRAND_NAMES: Record<Brand, string> = {
  visa: "VISA",
  mastercard: "mastercard",
  amex: "AMERICAN EXPRESS",
  elo: "elo",
  hipercard: "Hipercard",
};

// A tint per brand, so the card "becomes" the payer's card as the first digits land.
const BRAND_SURFACES: Record<Brand | "unknown", string> = {
  unknown: "from-slate-600 to-slate-800",
  visa: "from-blue-700 to-indigo-900",
  mastercard: "from-neutral-800 to-orange-700",
  amex: "from-sky-600 to-cyan-800",
  elo: "from-neutral-900 to-yellow-700",
  hipercard: "from-red-700 to-rose-900",
};

// Dots where no digit was typed yet, grouped like the brand prints it.
function maskedNumber(digits: string, brand: Brand | null): string {
  const length = Math.max(brand === "amex" ? 15 : 16, digits.length);
  return groupDigits(digits.padEnd(length, "•"), brand);
}

/**
 * Decorative: the form is the source and a screen reader reads the form, so the whole card is
 * aria-hidden. It renders only the form's current state; once the form clears, so does the card.
 */
export function CardPreview({
  digits,
  holder,
  expiry,
  cvvLength,
  cvvTyped,
  brand,
  flipped,
}: Props) {
  const surface = BRAND_SURFACES[brand ?? "unknown"];

  return (
    <div aria-hidden="true" className="card-scene mx-auto w-full max-w-[340px]">
      <div className="card-flipper aspect-[1.586] w-full" data-flipped={flipped}>
        <div
          className={`card-face rounded-2xl bg-gradient-to-br ${surface} p-5 text-white shadow-lg transition-[background] duration-[var(--motion-base)]`}
        >
          <div className="flex items-start justify-between">
            <span className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90" />
            <span className="text-sm font-bold tracking-wide italic">
              {brand ? BRAND_NAMES[brand] : ""}
            </span>
          </div>
          <p
            data-testid="preview-number"
            className="mt-6 font-mono text-[19px] tracking-[0.12em] whitespace-nowrap tabular-nums"
          >
            {maskedNumber(digits, brand)}
          </p>
          <div className="mt-5 flex items-end justify-between gap-4 text-xs uppercase">
            <div className="min-w-0">
              <p className="text-[9px] tracking-widest text-white/70">Nome</p>
              <p className="truncate text-sm tracking-wide">{holder.trim() || "Seu nome aqui"}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[9px] tracking-widest text-white/70">Validade</p>
              <p className="font-mono text-sm">{expiry || "MM/AA"}</p>
            </div>
          </div>
        </div>
        <div
          className={`card-face card-face-back rounded-2xl bg-gradient-to-br ${surface} pt-6 text-white shadow-lg`}
        >
          <div className="h-10 bg-black/70" />
          <div className="mx-5 mt-5 flex items-center justify-end rounded bg-white/90 px-3 py-1.5">
            <span className="font-mono text-sm text-neutral-900 tracking-widest">
              {"•".repeat(cvvTyped).padEnd(cvvLength, "·")}
            </span>
          </div>
          <p className="mx-5 mt-2 text-right text-[9px] tracking-widest text-white/70 uppercase">
            Código de segurança
          </p>
        </div>
      </div>
    </div>
  );
}
