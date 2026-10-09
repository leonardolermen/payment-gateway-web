import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { TextField } from "../customer/TextField";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { AUTH_LINK_CLASSES, AuthShell } from "./AuthShell";
import { login } from "./authApi";
import { PasswordField } from "./PasswordField";
import { safeNext } from "./safeNext";

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsPending(true);
    setFailure(null);

    try {
      await login({ email: email.trim(), password });
      // Whatever is cached belongs to a previous user; the new session starts empty.
      queryClient.clear();
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (error) {
      setFailure(messageFor(error));
    } finally {
      setPassword("");
      setIsPending(false);
    }
  }

  const footer = (
    <>
      <Link to="/signup" className={AUTH_LINK_CLASSES}>
        Criar conta
      </Link>
      <Link to="/forgot" className={AUTH_LINK_CLASSES}>
        Esqueci a senha
      </Link>
    </>
  );

  return (
    <AuthShell title="Entrar no painel" footer={footer}>
      <form noValidate onSubmit={submit} className="space-y-4">
        {failure && (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        )}
        <TextField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          id="password"
          label="Senha"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
