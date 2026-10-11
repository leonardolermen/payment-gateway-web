import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useCan } from "../auth/useCan";
import { listCards } from "../customer/cardApi";
import { customerKeys } from "../customer/customerApi";
import { ExistingCustomer } from "../customer/CustomerPicker";
import { TextField } from "../customer/TextField";
import type { CustomerChoice } from "../customer/types";
import type { PaymentMethod } from "../order/types";
import { listPlans, planKeys } from "../plan/planApi";
import { priceLabel } from "../plan/planLabels";
import { messageFor, provesNothingWasCreated } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { NoSubscriptionSelected } from "./NoSubscriptionSelected";
import { SavedCardSelect } from "./SavedCardSelect";
import { createSubscription, subscriptionKeys } from "./subscriptionApi";
import { SubscriptionLinkPanel } from "./SubscriptionLinkPanel";
import type { NewSubscription, Subscription } from "./types";

const METHODS: { label: string; value: PaymentMethod }[] = [
  { label: "Pix", value: "PIX" },
  { label: "Boleto", value: "BOLECODE" },
  { label: "Cartão", value: "CARD" },
];

// A deep link from a role that cannot create lands on the hint, as the list shows no button.
export function NewSubscriptionForm() {
  const mayCreateSubscription = useCan("create_subscription");

  if (!mayCreateSubscription) {
    return <NoSubscriptionSelected />;
  }

  return <NewSubscriptionFields />;
}

function NewSubscriptionFields() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // One key until the gateway gives a clear answer: success, or a refusal that created nothing.
  // Editing the form after a 5xx or a lost response does not make it a new subscription.
  const idempotencyKey = useIdempotencyKey();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [planId, setPlanId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  // undefined until a card or the link is picked: no card is charged by default.
  const [cardChoice, setCardChoice] = useState<string | null | undefined>(undefined);
  const [startAt, setStartAt] = useState("");
  const [missing, setMissing] = useState({ customer: false, plan: false, card: false });
  const [awaitingCard, setAwaitingCard] = useState<Subscription | null>(null);

  const plans = useQuery({ queryKey: planKeys.list(true), queryFn: () => listPlans(true) });

  const wantsCards = method === "CARD" && customerId !== null;
  const cards = useQuery({
    queryKey: customerKeys.cards(customerId ?? ""),
    queryFn: wantsCards && customerId !== null ? () => listCards(customerId) : skipToken,
  });
  // Submitting before the cards arrive, or after they failed, would hide a choice from the user.
  const cardsUnavailable = wantsCards && (cards.isPending || cards.isError);

  const create = useMutation({
    mutationFn: (body: NewSubscription) => createSubscription(body, idempotencyKey.current()),
    // The response may carry the one-time checkout link: the mutation is dropped with the form.
    gcTime: 0,
    onError: (error) => {
      if (provesNothingWasCreated(error)) {
        idempotencyKey.renew();
      }
    },
    onSuccess: (subscription) => {
      idempotencyKey.renew();

      // Invalidated, never seeded with the response: the cache outlives this panel, and the link
      // inside the response must not.
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });

      if (subscription.first_invoice !== null) {
        setAwaitingCard(subscription);
        return;
      }

      navigate(`/app/subscriptions/${subscription.id}`);
    },
  });

  function chooseCustomer(choice: CustomerChoice | null) {
    setCustomerId(choice !== null && "customer_id" in choice ? choice.customer_id : null);
    // Another customer has other cards.
    setCardChoice(undefined);
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const nextMissing = {
      customer: customerId === null,
      plan: planId === "",
      card: wantsCards && cards.isSuccess && cardChoice === undefined,
    };
    setMissing(nextMissing);

    if (customerId === null || cardsUnavailable || Object.values(nextMissing).some(Boolean)) {
      return;
    }

    const body: NewSubscription = {
      customer_id: customerId,
      plan_id: planId,
      method,
      ...(method === "CARD" && typeof cardChoice === "string" && { card_id: cardChoice }),
      ...(startAt !== "" && { start_at: startAt }),
    };

    create.mutate(body);
  }

  if (awaitingCard?.first_invoice) {
    return (
      <SubscriptionLinkPanel
        firstInvoice={awaitingCard.first_invoice}
        onDone={() => navigate(`/app/subscriptions/${awaitingCard.id}`)}
      />
    );
  }

  return (
    <Card>
      <h2 className="mb-4 font-display text-[15px] font-semibold">Nova assinatura</h2>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* Existing customers only: the subscription API takes a customer_id, never an inline one. */}
        <fieldset className="space-y-3">
          <legend className="pr-2 text-[10px] font-medium tracking-wider text-muted uppercase">
            Cliente
          </legend>
          <ExistingCustomer
            value={customerId !== null ? { customer_id: customerId } : null}
            onChange={chooseCustomer}
          />
          {missing.customer && (
            <p role="alert" className="text-sm text-danger">
              Escolha um cliente.
            </p>
          )}
        </fieldset>

        <Field
          label="Plano"
          htmlFor="subscription-plan"
          error={missing.plan ? "Escolha um plano." : undefined}
          errorId="subscription-plan-error"
        >
          <select
            id="subscription-plan"
            value={planId}
            aria-invalid={missing.plan ? true : undefined}
            aria-describedby={missing.plan ? "subscription-plan-error" : undefined}
            className={INPUT_CLASSES}
            onChange={(event) => setPlanId(event.target.value)}
          >
            <option value="">Escolha um plano</option>
            {plans.data?.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {priceLabel(plan)}
              </option>
            ))}
          </select>
        </Field>

        {plans.isError && (
          <p className="text-sm text-danger">Não foi possível carregar os planos.</p>
        )}

        <fieldset className="space-y-2">
          <legend className="pr-2 text-[10px] font-medium tracking-wider text-muted uppercase">
            Método
          </legend>
          <div className="flex gap-4 text-sm [&_input]:accent-accent">
            {METHODS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="subscription-method"
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                />{" "}
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {wantsCards && cards.isSuccess && (
          <SavedCardSelect
            cards={cards.data}
            value={cardChoice}
            onChange={setCardChoice}
            error={missing.card ? "Escolha um cartão ou o link" : undefined}
          />
        )}

        {wantsCards && cards.isError && (
          <p role="alert" className="text-sm text-danger">
            Não foi possível carregar os cartões deste cliente.
          </p>
        )}

        <TextField
          label="Início"
          type="date"
          value={startAt}
          onChange={(event) => setStartAt(event.target.value)}
        />

        {create.isError && (
          <p role="alert" className="text-sm text-danger">
            {messageFor(create.error)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={create.isPending || cardsUnavailable}>
          Criar assinatura
        </Button>
      </form>
    </Card>
  );
}
