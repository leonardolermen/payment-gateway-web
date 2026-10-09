import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { codeOf } from "./authErrors";
import { AUTH_LINK_CLASSES, AuthShell } from "./AuthShell";
import { resetPassword } from "./authApi";
import { PasswordField } from "./PasswordField";

type Outcome = "form" | "done" | "expired";

export function ResetPage() {
  const { token = "" } = useParams();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mismatch, setMismatch] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("form");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);

    if (password !== confirmation) {
      setMismatch("As senhas não conferem");
      return;
    }

    setMismatch(undefined);
    setIsPending(true);

    try {
      await resetPassword(token, password);
      setOutcome("done");
    } catch (error) {
      if (codeOf(error) === "TOKEN_EXPIRED") {
        setOutcome("expired");
      } else {
        setFailure(messageFor(error));
      }
    } finally {
      setPassword("");
      setConfirmation("");
      setIsPending(false);
    }
  }

  return (
    <AuthShell title="Nova senha">
      {outcome === "done" && (
        <p className="text-sm">
          Senha redefinida.{" "}
          <Link to="/login" className={AUTH_LINK_CLASSES}>
            Entrar
          </Link>
        </p>
      )}
      {outcome === "expired" && (
        <p className="text-sm">
          Este link não vale mais.{" "}
          <Link to="/forgot" className={AUTH_LINK_CLASSES}>
            Pedir outro link
          </Link>
        </p>
      )}
      {outcome === "form" && (
        <form noValidate onSubmit={submit} className="space-y-4">
          {failure && (
            <p role="alert" className="text-sm text-danger">
              {failure}
            </p>
          )}
          <PasswordField
            id="password"
            label="Nova senha"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            showStrength
          />
          <PasswordField
            id="confirmation"
            label="Confirmar senha"
            autoComplete="new-password"
            value={confirmation}
            error={mismatch}
            onChange={setConfirmation}
          />
          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            Redefinir senha
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
