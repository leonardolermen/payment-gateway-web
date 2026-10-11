import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "../support/ConfirmDialog";
import { conflictMessageFor } from "../support/gatewayError";
import { customerKeys, deleteCustomer } from "./customerApi";
import { TextField } from "./TextField";
import type { Customer } from "./types";

type Props = { customer: Customer; onClose: () => void };

export function DeleteCustomerDialog({ customer, onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");

  // Typing the exact name, case included, is the friction that keeps a deletion that cannot be
  // undone from being one stray click.
  const nameMatches = typed.trim() === customer.name.trim();

  // A 409 keeps the dialog open with the gateway's detail: it names the subscription to cancel.
  const removal = useMutation({
    mutationFn: () => deleteCustomer(customer.id),
    onSuccess: () => {
      // Leave before dropping the cache: a still-mounted detail would refetch a customer that is
      // gone and flash a "not found".
      void navigate("/app/customers");
      queryClient.removeQueries({ queryKey: customerKeys.detail(customer.id) });
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });

  return (
    <ConfirmDialog
      title="Excluir cliente?"
      confirmLabel="Excluir"
      pending={removal.isPending}
      confirmDisabled={!nameMatches}
      error={removal.isError ? conflictMessageFor(removal.error) : null}
      onConfirm={() => removal.mutate()}
      onCancel={onClose}
    >
      <p className="text-sm text-muted">
        A exclusão atende à LGPD e não pode ser desfeita: {customer.name} sai da lista de clientes e
        não pode mais ser escolhido numa cobrança.
      </p>

      <TextField
        label="Digite o nome do cliente para confirmar"
        autoComplete="off"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
    </ConfirmDialog>
  );
}
