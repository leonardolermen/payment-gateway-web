import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { TextField } from "../customer/TextField";
import { Button } from "../support/ui/Button";
import { fieldErrors } from "./authErrors";
import { AUTH_LINK_CLASSES, AuthShell } from "./AuthShell";
import { signup } from "./authApi";
import { PasswordField } from "./PasswordField";

type Errors = Partial<Record<"email" | "password" | "form", string>>;

const FIELD_FOR_CODE = { EMAIL_TAKEN: "email", WEAK_PASSWORD: "password" } as const;

export function SignupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [storeName, setStoreName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsPending(true);
    setErrors({});

    try {
      await signup({
        store_name: storeName.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
      });
      queryClient.clear();
      navigate("/app/orders", { replace: true });
    } catch (error) {
      setErrors(fieldErrors(error, FIELD_FOR_CODE));
    } finally {
      setPassword("");
      setIsPending(false);
    }
  }

  const footer = (
    <Link to="/login" className={AUTH_LINK_CLASSES}>
      Já tem conta? Entrar
    </Link>
  );

  return (
    <AuthShell title="Criar conta" footer={footer}>
      <form noValidate onSubmit={submit} className="space-y-4">
        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        )}
        <TextField
          id="store-name"
          label="Nome da loja"
          autoComplete="organization"
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
        />
        <TextField
          id="name"
          label="Seu nome"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
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
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
