import { useState, type FormEvent } from "react";
import { changePassword } from "../../auth/authApi";
import { PasswordField } from "../../auth/PasswordField";
import { GatewayRequestError, messageFor } from "../../support/gatewayError";
import { Button } from "../../support/ui/Button";
import { Card } from "../../support/ui/Card";

type PasswordFieldName = "current" | "next" | "confirmation";
type FieldErrors = Partial<Record<PasswordFieldName | "form", string>>;

// INVALID_CREDENTIALS' shared copy talks about e-mail; here only the current password is asked.
const FIELD_FOR_CODE: Record<string, { field: PasswordFieldName; message?: string }> = {
  INVALID_CREDENTIALS: { field: "current", message: "Senha atual incorreta." },
  WEAK_PASSWORD: { field: "next" },
};

function errorsFor(error: unknown): FieldErrors {
  const code = error instanceof GatewayRequestError ? error.error.code : "";
  const target = FIELD_FOR_CODE[code];

  if (!target) {
    return { form: messageFor(error) };
  }

  return { [target.field]: target.message ?? messageFor(error) };
}

export function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, setPending] = useState(false);
  const [changed, setChanged] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setChanged(false);

    if (next !== confirmation) {
      setErrors({ confirmation: "As senhas não conferem" });
      return;
    }

    setErrors({});
    setPending(true);

    try {
      await changePassword(current, next);
      setChanged(true);
    } catch (e) {
      setErrors(errorsFor(e));
    } finally {
      // Passwords never outlive the request, whatever its answer.
      setCurrent("");
      setNext("");
      setConfirmation("");
      setPending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <h2 className="font-display text-base font-semibold">Senha</h2>
        <PasswordField
          id="password-current"
          label="Senha atual"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
          error={errors.current}
        />
        <PasswordField
          id="password-new"
          label="Nova senha"
          autoComplete="new-password"
          showStrength
          value={next}
          onChange={setNext}
          error={errors.next}
        />
        <PasswordField
          id="password-confirmation"
          label="Confirmar nova senha"
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          error={errors.confirmation}
        />

        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={isPending}>
            Alterar senha
          </Button>
          {changed && (
            <p className="text-sm text-ok-fg">
              Senha alterada; as outras sessões foram encerradas.
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
