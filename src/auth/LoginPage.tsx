import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { storeApiKey } from "./apiKey";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { Field } from "../support/ui/Field";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { ThemeToggle } from "../support/ui/ThemeToggle";
import { getMerchant } from "./merchantApi";

// Same-origin paths only: `next` comes from the URL and must not become an open redirect.
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app/orders";
}

// Still a key, not a password: e-mail/password login is the gateway's next project (spec §5).
export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [key, setKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);

    try {
      const trimmed = key.trim();
      await getMerchant(trimmed);
      storeApiKey(trimmed);
      // Whatever is cached belongs to a previous key; the new session starts empty.
      queryClient.clear();
      navigate(safeNext(params.get("next")), { replace: true });
    } catch {
      // Fixed copy: the server detail is not for the screen, and a network failure reads the same here.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg px-4 pt-20 text-ink">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="size-9 shrink-0 rounded-[10px] bg-accent" />
          <div className="min-w-0">
            <p className="font-chrome text-[11px] font-semibold tracking-wider text-muted uppercase">
              Payment Gateway
            </p>
            <h1 className="font-display text-2xl font-semibold">Entrar no painel</h1>
          </div>
          <span className="ml-auto">
            <ThemeToggle />
          </span>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Chave de API"
              htmlFor="api-key"
              hint={
                <>
                  A chave começa com <code>gk_test_</code> ou <code>gk_live_</code> e foi entregue
                  pelo operador. Chaves de teste não movem dinheiro.
                </>
              }
            >
              <div className="flex gap-2">
                <input
                  id="api-key"
                  type={revealed ? "text" : "password"}
                  name="chave"
                  autoComplete="off"
                  spellCheck={false}
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  className={`${INPUT_CLASSES} font-mono`}
                />
                <Button variant="ghost" onClick={() => setRevealed((shown) => !shown)}>
                  {revealed ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
            </Field>
            {failed && (
              <p role="alert" className="text-sm text-danger">
                Chave de API inválida.
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy || key.trim() === ""}>
              Entrar
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted">
          A chave fica só nesta aba e some quando ela fecha.
        </p>
      </div>
    </main>
  );
}
