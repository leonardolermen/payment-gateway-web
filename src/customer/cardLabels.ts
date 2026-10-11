import type { SavedCard } from "./types";

// The API sends the brand upper case ("VISA"); the panel writes it as a name.
export function brandName(brand: string): string {
  return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
}

// "Visa final 4242": enough to tell the cards apart, and all the panel ever sees of one.
export function cardLabel(card: SavedCard): string {
  return `${brandName(card.brand)} final ${card.last4}`;
}
