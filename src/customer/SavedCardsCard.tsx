import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useCan } from "../auth/useCan";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { Table } from "../support/ui/Table";
import { cardKeys, deleteCard, listCards } from "./cardApi";
import { brandName } from "./cardLabels";
import { customerKeys } from "./customerApi";
import type { SavedCard } from "./types";

const HEADERS = ["Bandeira", "Final", "Validade", "Titular"];

type Props = { customerId: string };

function SavedCardRow({ card, customerId }: { card: SavedCard; customerId: string }) {
  const queryClient = useQueryClient();
  const mayDeleteCard = useCan("delete_card");
  const [confirming, setConfirming] = useState(false);

  // The dialog stays up (button disabled) until the refetched list drops the row, so the row
  // never flashes back with its "Remover" in between. A failure closes it and lands on the row.
  const removal = useMutation({
    mutationFn: () => deleteCard(card.id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: customerKeys.cards(customerId) }),
        // A subscription header may still show this card by its own key.
        queryClient.invalidateQueries({ queryKey: cardKeys.detail(card.id) }),
      ]),
    onSettled: () => setConfirming(false),
  });

  function askToRemove() {
    removal.reset();
    setConfirming(true);
  }

  return (
    <tr>
      <td className="font-medium">{brandName(card.brand)}</td>
      <td className="font-mono text-xs whitespace-nowrap">final {card.last4}</td>
      <td className="font-mono text-xs">{card.expiry}</td>
      <td>{card.holder}</td>
      {mayDeleteCard && (
        <td className="space-y-1">
          <Button variant="danger-ghost" size="sm" onClick={askToRemove}>
            Remover
          </Button>

          {removal.isError && (
            <p role="alert" className="text-sm text-danger">
              {messageFor(removal.error)}
            </p>
          )}

          {confirming && (
            <ConfirmDialog
              title="Remover cartão?"
              confirmLabel="Remover"
              pending={removal.isPending}
              error={null}
              onConfirm={() => removal.mutate()}
              onCancel={() => setConfirming(false)}
            >
              <p className="text-sm text-muted">
                O cartão {brandName(card.brand)} final {card.last4} deixa de poder ser cobrado. Se
                uma assinatura cobra este cartão, a próxima cobrança vai falhar.
              </p>
            </ConfirmDialog>
          )}
        </td>
      )}
    </tr>
  );
}

export function SavedCardsCard({ customerId }: Props) {
  const mayDeleteCard = useCan("delete_card");
  const cards = useQuery({
    queryKey: customerKeys.cards(customerId),
    queryFn: () => listCards(customerId),
  });

  const headers = mayDeleteCard ? [...HEADERS, "Ações"] : HEADERS;

  return (
    <Card>
      <section aria-labelledby="saved-cards-title" className="space-y-3">
        <h2 id="saved-cards-title" className="font-display text-base font-semibold">
          Cartões salvos
        </h2>

        {cards.isError && (
          <p role="alert" className="text-sm text-danger">
            Não foi possível carregar os cartões.
          </p>
        )}

        {cards.data && cards.data.length > 0 && (
          <Table headers={headers}>
            {cards.data.map((card) => (
              <SavedCardRow key={card.id} card={card} customerId={customerId} />
            ))}
          </Table>
        )}

        {cards.data?.length === 0 && <p className="text-sm text-muted">Nenhum cartão salvo.</p>}
      </section>
    </Card>
  );
}
