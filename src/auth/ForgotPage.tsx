import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { TextField } from "../customer/TextField";
import { Button } from "../support/ui/Button";
import { AUTH_LINK_CLASSES, AuthShell } from "./AuthShell";
import { forgotPassword } from "./authApi";

export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [wasSent, setWasSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsPending(true);

    try {
      await forgotPassword(email.trim());
    } catch {
      // Swallowed on purpose, 5xx and network failures included: any answer other than the same copy
      // would say whether the e-mail exists, and a retry is one click on "Voltar para entrar" away.
    } finally {
      setIsPending(false);
      setWasSent(true);
    }
  }

  const footer = (
    <Link to="/login" className={AUTH_LINK_CLASSES}>
      Voltar para entrar
    </Link>
  );

  return (
    <AuthShell title="Redefinir senha" footer={footer}>
      {wasSent ? (
        <p className="text-sm">Se este e-mail tiver conta, enviamos um link. Vale por 1 hora.</p>
      ) : (
        <form noValidate onSubmit={submit} className="space-y-4">
          <TextField
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
