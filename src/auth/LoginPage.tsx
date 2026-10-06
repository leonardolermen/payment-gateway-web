import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { storeApiKey } from "./apiKey";
import { Button } from "../support/ui/Button";
import { Card } from "../support/ui/Card";
import { INPUT_CLASSES } from "../support/ui/inputClasses";
import { ThemeToggle } from "../support/ui/ThemeToggle";
import { getMerchant } from "./merchantApi";

// Same-origin paths only: `next` comes from the URL and must not become an open redirect.
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app/orders";
}

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [key, setKey] = useState("");
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
    <main className="min-h-screen bg-bg px-4 pt-24 text-ink">
      <Card className="mx-auto max-w-sm">
        <div className="mb-4 flex items-center gap-2">
          <span aria-hidden="true" className="size-6 rounded-md bg-accent" />
          <h1 className="font-display text-2xl font-semibold">Entrar no painel</h1>
          <span className="ml-auto">
            <ThemeToggle />
          </span>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium">
            Chave de API
            <input
              type="password"
              name="chave"
              autoComplete="off"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              className={`${INPUT_CLASSES} mt-1`}
            />
          </label>
          {failed && (
            <p role="alert" className="text-sm text-danger">
              Chave de API inválida.
            </p>
          )}
          <Button type="submit" size="lg" disabled={busy || key.trim() === ""}>
            Entrar
          </Button>
        </form>
      </Card>
    </main>
  );
}
