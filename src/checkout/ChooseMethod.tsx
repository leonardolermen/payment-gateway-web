import { useState } from "react";
import { GatewayRequestError, messageFor } from "../support/gatewayError";
import { createAttempt } from "./checkoutApi";
import type { Event } from "./checkoutState";
import type { AttemptBody, Method } from "./types";

type Props = { token: string; methods: Method[]; send: (event: Event) => void };

const LABELS: Record<Method, string> = { PIX: "Pix", BOLECODE: "Boleto", CARD: "Cartão" };

// Card has no attempt until the form is submitted; Pix and boleto are created on the click.
const IMMEDIATE: Partial<Record<Method, AttemptBody>> = {
  PIX: { method: "PIX" },
  BOLECODE: { method: "BOLECODE" },
};

export function ChooseMethod({ token, methods, send }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function choose(method: Method) {
    send({ type: "choose", method });

    const body = IMMEDIATE[method];
    if (!body) {
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const payment = await createAttempt(token, body);
      send({ type: "attempt_created", payment });
    } catch (e) {
      const code = e instanceof GatewayRequestError ? e.error.code : "UNKNOWN";
      setError(messageFor(e));
      send({ type: "attempt_failed", code, message: messageFor(e) });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Como você quer pagar?</h2>
      <div className="flex flex-col gap-2">
        {methods.map((method) => (
          <button
            key={method}
            type="button"
            disabled={isCreating}
            className="rounded border px-4 py-3 text-left"
            onClick={() => void choose(method)}
          >
            {LABELS[method]}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
