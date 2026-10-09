import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { Environment } from "../../auth/environment";
import { GatewayRequestError, messageFor } from "../../support/gatewayError";
import { Button } from "../../support/ui/Button";
import { providerKeys, putNotificationKey } from "./providersApi";
import { SecretField } from "./SecretField";

type Props = { environment: Environment; keySet: boolean };

type KeyErrors = { key?: string; form?: string };

// The gateway names the offending field as `key`; anything else (a 403, the network) is the form's.
function keyErrors(error: unknown): KeyErrors {
  const field = error instanceof GatewayRequestError ? error.error.field : undefined;

  return { [field === "key" ? "key" : "form"]: messageFor(error) };
}

export function NotificationKeyForm({ environment, keySet }: Props) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [errors, setErrors] = useState<KeyErrors>({});

  const save = useMutation({
    mutationFn: () => putNotificationKey(key.trim()),
    onSuccess: () => {
      setKey("");
      return queryClient.invalidateQueries({ queryKey: providerKeys.overview(environment) });
    },
    onError: (error) => setErrors(keyErrors(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    save.mutate();
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-3">
      <p className="text-xs text-muted">
        {keySet ? "Chave de notificação definida" : "Chave de notificação não definida"}
      </p>
      <SecretField
        id="CIELO-notification-key"
        label="Chave de notificação"
        value={key}
        onChange={setKey}
        secret={{ isSet: keySet }}
        error={errors.key}
      />

      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {errors.form}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="ghost" disabled={save.isPending || key.trim() === ""}>
          Salvar chave
        </Button>
        {save.isSuccess && <span className="text-sm text-ok-fg">Chave salva</span>}
      </div>
    </form>
  );
}
