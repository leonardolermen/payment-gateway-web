import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { customerKeys, getCustomer } from "../customer/customerApi";
import { CustomerPicker } from "../customer/CustomerPicker";
import type { CustomerChoice } from "../customer/types";
import { TextField } from "../customer/TextField";
import { saoPauloLocalToIso } from "../support/dates";
import { messageFor } from "../support/gatewayError";
import { RestartAttempt } from "../support/RestartAttempt";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { useIdempotencyKey } from "../support/useIdempotencyKey";
import { MoneyInput } from "./MoneyInput";
import { createOrder, orderKeys } from "./orderApi";

type Props = { onCreated?: () => void; preselectedCustomerId?: string | null };

// Lives under the orders list, as in the mockup: creating does not leave the list. The workspace
// remounts it after a success, which also mints the next idempotency key.
export function NewOrderForm({ onCreated, preselectedCustomerId = null }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // One key until a clear answer: a double click or a retry after a timeout replays the same
  // order instead of creating a second one.
  const idempotencyKey = useIdempotencyKey();

  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  // undefined until the picker is touched; until then the preselected customer is the choice.
  const [pickedCustomer, setPickedCustomer] = useState<CustomerChoice | null | undefined>(
    undefined,
  );
  const [amountError, setAmountError] = useState(false);
  const [customerError, setCustomerError] = useState(false);

  const preselected = useQuery({
    queryKey: customerKeys.detail(preselectedCustomerId ?? ""),
    queryFn: preselectedCustomerId ? () => getCustomer(preselectedCustomerId) : skipToken,
  });

  // Only a customer that loaded is chosen: an id that does not resolve must never go out unseen.
  const customer =
    pickedCustomer !== undefined
      ? pickedCustomer
      : preselected.data
        ? { customer_id: preselected.data.id }
        : null;

  const create = useMutation({
    mutationFn: (body: Parameters<typeof createOrder>[0]) =>
      createOrder(body, idempotencyKey.current()),
    onError: (error) => idempotencyKey.renewIfNothingWasCreated(error),
    onSuccess: (order) => {
      idempotencyKey.renew();
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      // Task 5 reads the state: the link is shown once, right after creation.
      navigate(`/app/orders/${order.id}`, { state: { checkoutUrl: order.checkout_url } });
      onCreated?.();
    },
  });

  // The operator checked and found nothing created: the same form goes out under a new key.
  function restart() {
    idempotencyKey.renew();
    create.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    setAmountError(amount === null);
    setCustomerError(customer === null);

    // The gateway wants exactly one of customer_id or inline customer and answers 400 otherwise.
    if (amount === null || customer === null) {
      return;
    }

    const expiresAt = saoPauloLocalToIso(expiresLocal);

    create.mutate({
      amount,
      currency: "BRL",
      ...(description.trim() !== "" && { description: description.trim() }),
      ...(reference.trim() !== "" && { reference: reference.trim() }),
      ...(expiresAt !== null && { expires_at: expiresAt }),
      ...customer,
    });
  }

  return (
    <Card>
      <h2 className="mb-4 font-display text-[15px] font-semibold">Nova cobrança</h2>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <MoneyInput valueCents={amount} onChange={setAmount} />
        {amountError && <p className="text-sm text-danger">Informe um valor válido.</p>}

        <TextField
          label="Descrição"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <CustomerPicker
          value={customer}
          onChange={setPickedCustomer}
          preselected={preselected.data}
        />

        {customerError && <p className="text-sm text-danger">Escolha ou informe um cliente.</p>}

        {/* Not in the mockup, kept: most charges need neither, so they fold away. */}
        <details className="group text-sm">
          <summary className="cursor-pointer text-muted select-none hover:text-ink">
            Referência e vencimento
          </summary>
          <div className="mt-3 space-y-4">
            <TextField
              label="Referência"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
            <TextField
              label="Vencimento"
              type="datetime-local"
              value={expiresLocal}
              onChange={(event) => setExpiresLocal(event.target.value)}
            />
          </div>
        </details>

        {create.isError && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-danger">
              {messageFor(create.error)}
            </p>
            <RestartAttempt error={create.error} onRestart={restart} />
          </div>
        )}

        <Button type="submit" size="lg" disabled={create.isPending}>
          Criar cobrança
        </Button>
      </form>
    </Card>
  );
}
