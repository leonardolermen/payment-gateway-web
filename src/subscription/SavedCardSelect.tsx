import { brandName } from "../customer/cardLabels";
import type { SavedCard } from "../customer/types";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";

// Nothing is preselected: charging a card nobody picked is worse than asking.
const UNCHOSEN = "";
// No card: the gateway then answers INCOMPLETE with a checkout link.
const BY_LINK = "by-link";

type Props = {
  cards: SavedCard[];
  // undefined: not chosen yet; null: the payer registers the card through the link.
  value: string | null | undefined;
  onChange: (cardId: string | null) => void;
  error?: string;
};

function savedCardLabel(card: SavedCard): string {
  return `${brandName(card.brand)} final ${card.last4} · ${card.expiry}`;
}

function optionValue(value: string | null | undefined): string {
  if (value === undefined) {
    return UNCHOSEN;
  }

  return value ?? BY_LINK;
}

export function SavedCardSelect({ cards, value, onChange, error }: Props) {
  return (
    <Field
      label="Cartão salvo"
      htmlFor="subscription-card"
      error={error}
      errorId="subscription-card-error"
    >
      <select
        id="subscription-card"
        value={optionValue(value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "subscription-card-error" : undefined}
        className={INPUT_CLASSES}
        onChange={(event) => onChange(event.target.value === BY_LINK ? null : event.target.value)}
      >
        <option value={UNCHOSEN} disabled>
          Escolha um cartão…
        </option>
        {cards.map((card) => (
          <option key={card.id} value={card.id}>
            {savedCardLabel(card)}
          </option>
        ))}
        <option value={BY_LINK}>O pagador cadastra o cartão pelo link</option>
      </select>
    </Field>
  );
}
