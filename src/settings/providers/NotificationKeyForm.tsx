import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { Environment } from "../../auth/environment";
import { messageFor } from "../../support/gatewayError";
import { Button } from "../../support/ui/Button";
import { providerKeys, putNotificationKey } from "./providersApi";
import { SecretField } from "./SecretField";

type Props = { environment: Environment; keySet: boolean };

export function NotificationKeyForm({ environment, keySet }: Props) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");

  const save = useMutation({
    mutationFn: () => putNotificationKey(key.trim()),
    onSuccess: () => {
      setKey("");
      return queryClient.invalidateQueries({ queryKey: providerKeys.overview(environment) });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
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
      />

      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(save.error)}
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
