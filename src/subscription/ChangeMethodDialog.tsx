import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listCards } from "../customer/cardApi";
import { customerKeys } from "../customer/customerApi";
import type { PaymentMethod } from "../order/types";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { SavedCardSelect } from "./SavedCardSelect";
import { patchSubscription, subscriptionKeys } from "./subscriptionApi";
import type { Subscription, SubscriptionMethodChange } from "./types";

type Props = { subscription: Subscription; onClose: () => void };

const METHODS: { label: string; value: PaymentMethod }[] = [
  { label: "Pix", value: "PIX" },
  { label: "Boleto", value: "BOLECODE" },
  { label: "Cartão", value: "CARD" },
];

export function ChangeMethodDialog({ subscription, onClose }: Props) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>(subscription.method);
  // undefined: not chosen; null: "by link", which a method change cannot use.
  const [cardChoice, setCardChoice] = useState<string | null | undefined>(
    subscription.card_id ?? undefined,
  );
  const [cardMissing, setCardMissing] = useState(false);

  const wantsCard = method === "CARD";
  const cards = useQuery({
    queryKey: customerKeys.cards(subscription.customer_id),
    queryFn: wantsCard ? () => listCards(subscription.customer_id) : skipToken,
  });
  const hasNoCard = wantsCard && cards.isSuccess && cards.data.length === 0;

  const change = useMutation({
    mutationFn: (body: SubscriptionMethodChange) => patchSubscription(subscription.id, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      onClose();
    },
  });

  function chooseMethod(next: PaymentMethod) {
    setMethod(next);
    setCardMissing(false);
    change.reset();
  }

  function chooseCard(cardId: string | null) {
    setCardChoice(cardId);
    setCardMissing(false);
    change.reset();
  }

  function confirm() {
    if (method !== "CARD") {
      change.mutate({ method });
      return;
    }

    // The link is how a new subscription gets its first card: the gateway refuses CARD without a
    // card_id here (CARD_REQUIRED), so the panel asks instead of sending what will fail.
    if (typeof cardChoice !== "string") {
      setCardMissing(true);
      return;
    }

    change.mutate({ method, card_id: cardChoice });
  }

  const cardError = cardMissing ? "Escolha um cartão salvo." : undefined;
  const dialogError = change.isError ? messageFor(change.error) : null;

  return (
    <ConfirmDialog
      title="Trocar método de pagamento?"
      confirmLabel="Trocar método"
      pending={change.isPending}
      confirmDisabled={wantsCard && (!cards.isSuccess || hasNoCard)}
      error={dialogError}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <p className="text-sm text-muted">
        Vale a partir da próxima fatura; a fatura em aberto mantém o método com que saiu.
      </p>

      <fieldset className="space-y-2">
        <legend className="pr-2 text-[10px] font-medium tracking-wider text-muted uppercase">
          Método
        </legend>
        <div className="flex gap-4 text-sm [&_input]:accent-accent">
          {METHODS.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name="subscription-new-method"
                checked={method === option.value}
                onChange={() => chooseMethod(option.value)}
              />{" "}
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {wantsCard && cards.isSuccess && !hasNoCard && (
        <SavedCardSelect
          cards={cards.data}
          value={cardChoice}
          onChange={chooseCard}
          error={cardError}
        />
      )}

      {hasNoCard && (
        <p className="text-sm text-muted">
          Este cliente não tem cartão salvo. O cartão fica salvo quando ele paga uma fatura com
          cartão pelo link.
        </p>
      )}

      {wantsCard && cards.isError && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-danger">Não foi possível carregar os cartões deste cliente.</p>
          <Button variant="ghost" size="sm" onClick={() => void cards.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}
    </ConfirmDialog>
  );
}
