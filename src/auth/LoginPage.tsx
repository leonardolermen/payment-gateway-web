import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { storeApiKey } from "./apiKey";
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
    <main className="mx-auto mt-24 max-w-sm p-4">
      <h1 className="mb-4 text-xl font-semibold">Entrar no painel</h1>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          Chave de API
          <input
            type="password"
            name="chave"
            autoComplete="off"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        {failed && (
          <p role="alert" className="text-sm text-red-600">
            Chave de API inválida.
          </p>
        )}
        <button
          type="submit"
          disabled={busy || key.trim() === ""}
          className="rounded bg-black px-3 py-1 text-white"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
