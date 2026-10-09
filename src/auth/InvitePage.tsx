import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { TextField } from "../customer/TextField";
import { Button } from "../support/ui/Button";
import { codeOf, fieldErrors } from "./authErrors";
import { AUTH_LINK_CLASSES, AuthShell } from "./AuthShell";
import { acceptInvite } from "./authApi";
import { PasswordField } from "./PasswordField";

// Invite outcomes read differently from the generic gateway copy: they tell the invitee what to do.
const INVITE_COPY: Partial<Record<string, ReactNode>> = {
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

const FIELD_FOR_CODE = { WEAK_PASSWORD: "password" } as const;

type Errors = { password?: string; form?: ReactNode };

export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsPending(true);
    setErrors({});

    try {
      await acceptInvite(token, name.trim(), password);
      queryClient.clear();
      navigate("/app/orders", { replace: true });
    } catch (error) {
      const routed = fieldErrors(error, FIELD_FOR_CODE);
      setErrors({
        password: routed.password,
        form: routed.form && (INVITE_COPY[codeOf(error) ?? ""] ?? routed.form),
      });
    } finally {
      setPassword("");
      setIsPending(false);
    }
  }

  return (
    <AuthShell title="Aceitar convite">
      <form noValidate onSubmit={submit} className="space-y-4">
        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
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
          error={errors.password}
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
