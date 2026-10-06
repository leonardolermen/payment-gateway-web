import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { CustomerPicker } from "../customer/CustomerPicker";
import type { CustomerChoice } from "../customer/types";
import { TextField } from "../customer/TextField";
import { saoPauloLocalToIso } from "../support/dates";
import { messageFor } from "../support/gatewayError";
import { MoneyInput } from "./MoneyInput";
import { createOrder, orderKeys } from "./orderApi";

export function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Minted once per mounted form: a double click or a retry after a timeout replays the same
  // order instead of creating a second one.
  const idempotencyKey = useRef(crypto.randomUUID());

  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  const [customer, setCustomer] = useState<CustomerChoice | null>(null);
  const [amountError, setAmountError] = useState(false);

  const create = useMutation({
    mutationFn: (body: Parameters<typeof createOrder>[0]) => createOrder(body, idempotencyKey.current),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      // Task 5 reads the state: the link is shown once, right after creation.
      navigate(`/app/orders/${order.id}`, { state: { checkoutUrl: order.checkout_url } });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();

    if (amount === null) {
      setAmountError(true);
      return;
    }
    setAmountError(false);

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
    <section className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Nova cobrança</h1>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <MoneyInput valueCents={amount} onChange={setAmount} />
        {amountError && <p className="text-sm text-red-700">Informe um valor válido.</p>}

        <TextField
          label="Descrição"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
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

        <CustomerPicker value={customer} onChange={setCustomer} />

        {create.isError && <p role="alert">{messageFor(create.error)}</p>}

        <button
          type="submit"
          disabled={create.isPending}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Criar cobrança
        </button>
      </form>
    </section>
  );
}
