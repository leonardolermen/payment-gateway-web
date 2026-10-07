import { useState } from "react";
import { messageFor } from "../support/gatewayError";
import { createAttempt } from "./checkoutApi";
import type { Event } from "./checkoutState";
import { failureEvent } from "./failureEvent";
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
      setError(messageFor(e));
      send(failureEvent(e));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section>
      <h2
        data-step-heading
        tabIndex={-1}
        className="mb-3 font-display text-lg font-semibold outline-none"
      >
        Como você quer pagar?
      </h2>
      <div className="flex flex-wrap gap-2 rounded-pill bg-surface-muted p-1">
        {methods.map((method) => (
          <button
            key={method}
            type="button"
            disabled={isCreating}
            className="min-w-[30%] flex-1 rounded-pill px-4 py-2.5 font-medium text-ink hover:bg-accent hover:text-on-accent disabled:opacity-50"
            onClick={() => void choose(method)}
          >
            {LABELS[method]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
