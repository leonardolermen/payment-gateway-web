import type { Event, State } from "./checkoutState";
import { useAttemptPolling } from "./useAttemptPolling";

type Props = {
  token: string;
  step: Extract<State, { kind: "card_pending" }>;
  send: (event: Event) => void;
};

const POLL_INTERVAL_MS = 3_000;

// The acquirer took the card but has not answered: the payer waits here, never on an empty form.
export function CardPendingStep({ token, step, send }: Props) {
  useAttemptPolling(token, step.paymentId, POLL_INTERVAL_MS, send);

  return (
    <section className="py-6 text-center">
      <span
        aria-hidden="true"
        className="mx-auto mb-4 block size-10 animate-spin rounded-full border-4 border-accent border-t-transparent"
      />
      <h2
        data-step-heading
        tabIndex={-1}
        className="font-display text-lg font-semibold outline-none"
      >
        Estamos confirmando seu pagamento
      </h2>
      <p className="mt-2 text-sm text-muted">Isso leva alguns segundos. Não feche esta página.</p>
    </section>
  );
}
