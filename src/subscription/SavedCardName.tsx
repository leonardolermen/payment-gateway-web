import { useQuery } from "@tanstack/react-query";
import { cardKeys, getCard } from "../customer/cardApi";
import { cardLabel } from "../customer/cardLabels";

// "Visa final 4242", or nothing while it loads or when the card cannot be read (a removed card
// answers 404): the method is still shown next to it.
export function SavedCardName({ cardId }: { cardId: string }) {
  const card = useQuery({ queryKey: cardKeys.detail(cardId), queryFn: () => getCard(cardId) });

  if (!card.data) {
    return null;
  }

  return <span>{cardLabel(card.data)}</span>;
}
