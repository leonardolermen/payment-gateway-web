import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { messageFor } from "../support/gatewayError";
import { codeOf } from "./authErrors";
import { AUTH_LINK_CLASSES, AuthShell } from "./AuthShell";
import { verifyEmail } from "./authApi";

type Outcome =
  | { kind: "pending" }
  | { kind: "verified" }
  | { kind: "expired" }
  | { kind: "failed"; message: string };

export function VerifyPage() {
  const { token = "" } = useParams();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "pending" });
  // StrictMode mounts effects twice in dev; a token is single-use, so the second call would 410.
  const alreadyCalled = useRef(false);

  useEffect(() => {
    if (alreadyCalled.current) {
      return;
    }
    alreadyCalled.current = true;

    verifyEmail(token).then(
      () => setOutcome({ kind: "verified" }),
      (error: unknown) =>
        setOutcome(
          codeOf(error) === "TOKEN_EXPIRED"
            ? { kind: "expired" }
            : { kind: "failed", message: messageFor(error) },
        ),
    );
  }, [token]);

  return (
    <AuthShell title="Confirmar e-mail">
      {outcome.kind === "pending" && <p className="text-sm text-muted">Confirmando…</p>}
      {outcome.kind === "verified" && (
        <p className="text-sm">
          E-mail confirmado.{" "}
          <Link to="/app/orders" className={AUTH_LINK_CLASSES}>
            Ir para o painel
          </Link>
        </p>
      )}
      {outcome.kind === "expired" && (
        <p className="text-sm">
          Este link não vale mais. Entre no painel e peça um novo e-mail de confirmação.{" "}
          <Link to="/login" className={AUTH_LINK_CLASSES}>
            Entrar
          </Link>
        </p>
      )}
      {outcome.kind === "failed" && (
        <p role="alert" className="text-sm text-danger">
          {outcome.message}
        </p>
      )}
    </AuthShell>
  );
}
