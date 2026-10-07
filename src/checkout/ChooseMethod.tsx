import { useState, type ReactNode } from "react";
import { messageFor } from "../support/gatewayError";
import { createAttempt } from "./checkoutApi";
import type { Event } from "./checkoutState";
import { failureEvent } from "./failureEvent";
import type { AttemptBody, Method } from "./types";

type Props = {
  token: string;
  methods: Method[];
  send: (event: Event) => void;
  // The largest count the gateway offers; 1 or absent says nothing about installments.
  maxInstallments?: number;
};

function hintOf(method: Method, maxInstallments: number | undefined): string {
  if (method === "PIX") {
    return "Aprovação na hora";
  }
  if (method === "BOLECODE") {
    return "Compensa em até 3 dias úteis";
  }
  return maxInstallments && maxInstallments > 1 ? `Em até ${maxInstallments}x` : "Crédito, à vista";
}

const ICONS: Record<Method, ReactNode> = {
  PIX: (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3l9 9-9 9-9-9z" />
    </svg>
  ),
  BOLECODE: (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 5v14M8 5v14M11 5v14M15 5v14M18 5v14M20 5v14" />
    </svg>
  ),
  CARD: (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
};

const LABELS: Record<Method, string> = { PIX: "Pix", BOLECODE: "Boleto", CARD: "Cartão" };

// Card has no attempt until the form is submitted; Pix and boleto are created on the click.
const IMMEDIATE: Partial<Record<Method, AttemptBody>> = {
  PIX: { method: "PIX" },
  BOLECODE: { method: "BOLECODE" },
};

export function ChooseMethod({ token, methods, send, maxInstallments }: Props) {
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
      <ul className="space-y-2">
        {methods.map((method) => (
          <li key={method}>
            <button
              type="button"
              disabled={isCreating}
              // The name stays "Pix", "Boleto", "Cartão"; the line under it is a description.
              aria-labelledby={`method-${method}`}
              aria-describedby={`method-${method}-hint`}
              className="flex w-full items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left transition-colors duration-[var(--motion-fast)] hover:border-accent hover:bg-surface-muted disabled:opacity-50"
              onClick={() => void choose(method)}
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-accent"
              >
                {ICONS[method]}
              </span>
              <span className="min-w-0 flex-1">
                <span id={`method-${method}`} className="block font-semibold">
                  {LABELS[method]}
                </span>
                <span id={`method-${method}-hint`} className="block text-xs text-muted">
                  {hintOf(method, maxInstallments)}
                </span>
              </span>
              <span aria-hidden="true" className="text-muted">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
