import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { invite, meKeys } from "../../auth/authApi";
import type { Role } from "../../auth/types";
import { TextField } from "../../customer/TextField";
import { Field } from "../../support/ui/Field";
import { GatewayRequestError, messageFor } from "../../support/gatewayError";
import { Button } from "../../support/ui/Button";
import { RoleSelect } from "./RoleSelect";

// A taken e-mail is about the field; anything else (EMAIL_NOT_VERIFIED, network) is about the form.
function isEmailError(error: unknown): boolean {
  return error instanceof GatewayRequestError && error.error.code === "EMAIL_TAKEN";
}

export function InviteForm() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("READONLY");
  const sending = useMutation({
    mutationFn: () => invite(email.trim(), role),
    onSuccess: async () => {
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: meKeys.team });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    sending.mutate();
  }

  const emailError = isEmailError(sending.error) ? messageFor(sending.error) : undefined;
  const formError = sending.isError && !emailError ? messageFor(sending.error) : null;

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-display text-base font-semibold">Convidar</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <TextField
          id="invite-email"
          label="E-mail"
          type="email"
          autoComplete="off"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <Field label="Papel" htmlFor="invite-role">
          <RoleSelect id="invite-role" value={role} onChange={setRole} />
        </Field>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={sending.isPending}>
          Convidar
        </Button>
        {sending.isSuccess && <p className="text-sm text-ok-fg">Convite enviado</p>}
      </div>
    </form>
  );
}
