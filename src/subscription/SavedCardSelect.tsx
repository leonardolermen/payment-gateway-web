import type { SavedCard } from "../customer/types";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";

// The empty value is "no card": the gateway then answers INCOMPLETE with a checkout link.
const BY_LINK = "";

type Props = {
  cards: SavedCard[];
  value: string | null;
  onChange: (cardId: string | null) => void;
};

// The API sends the brand upper case ("VISA"); the panel writes it as a name.
function brandName(brand: string): string {
  return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
}

function savedCardLabel(card: SavedCard): string {
  return `${brandName(card.brand)} final ${card.last4} · ${card.expiry}`;
}

export function SavedCardSelect({ cards, value, onChange }: Props) {
  return (
    <Field label="Cartão salvo" htmlFor="subscription-card">
      <select
        id="subscription-card"
        value={value ?? BY_LINK}
        className={INPUT_CLASSES}
        onChange={(event) => onChange(event.target.value === BY_LINK ? null : event.target.value)}
      >
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
