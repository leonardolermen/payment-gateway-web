import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { meKeys, renameMe } from "../../auth/authApi";
import { TextField } from "../../customer/TextField";
import { messageFor } from "../../support/gatewayError";
import { Button } from "../../support/ui/Button";
import { Card } from "../../support/ui/Card";

export function RenameCard({ currentName }: { currentName: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(currentName);
  const rename = useMutation({
    mutationFn: renameMe,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meKeys.me }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    rename.mutate(name.trim());
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <h2 className="font-display text-base font-semibold">Nome</h2>
        <TextField
          id="profile-name"
          label="Nome"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={rename.isError ? messageFor(rename.error) : undefined}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={rename.isPending || name.trim() === ""}>
            Salvar
          </Button>
          {rename.isSuccess && <p className="text-sm text-ok-fg">Nome atualizado.</p>}
        </div>
      </form>
    </Card>
  );
}
