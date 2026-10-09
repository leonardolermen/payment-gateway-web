import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { TextField } from "../customer/TextField";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { codeOf } from "./authErrors";
import { AUTH_LINK_CLASSES, AuthShell } from "./AuthShell";
import { acceptInvite } from "./authApi";
import { PasswordField } from "./PasswordField";

// Invite outcomes read differently from the generic gateway copy: they tell the invitee what to do.
const INVITE_FAILURES: Record<string, ReactNode> = {
  TOKEN_EXPIRED: "Convite expirado — peça um novo ao dono da loja.",
  EMAIL_TAKEN: (
    <>
      Este e-mail já tem conta: entre com ela.{" "}
      <Link to="/login" className={AUTH_LINK_CLASSES}>
        Entrar
      </Link>
    </>
  ),
};

export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [failure, setFailure] = useState<ReactNode>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsPending(true);
    setFailure(null);
    setPasswordError(undefined);

    try {
      await acceptInvite(token, name.trim(), password);
      queryClient.clear();
      navigate("/app/orders", { replace: true });
    } catch (error) {
      const code = codeOf(error) ?? "";
      if (code === "WEAK_PASSWORD") {
        setPasswordError(messageFor(error));
      } else {
        setFailure(INVITE_FAILURES[code] ?? messageFor(error));
      }
    } finally {
      setPassword("");
      setIsPending(false);
    }
  }

  return (
    <AuthShell title="Aceitar convite">
      <form noValidate onSubmit={submit} className="space-y-4">
        {failure && (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        )}
        <TextField
          id="name"
          label="Seu nome"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <PasswordField
          id="password"
          label="Senha"
          autoComplete="new-password"
          value={password}
          error={passwordError}
          onChange={setPassword}
          showStrength
        />
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          Aceitar convite
        </Button>
      </form>
    </AuthShell>
  );
}
