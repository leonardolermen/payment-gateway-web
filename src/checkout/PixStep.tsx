import { useEffect, useState } from "react";
import { messageFor } from "../support/gatewayError";
import { Button } from "../support/ui/Button";
import { cancelAttempt, createAttempt } from "./checkoutApi";
import type { Event, State } from "./checkoutState";
import { CopyButton } from "./CopyButton";
import { failureEvent } from "./failureEvent";
import { QrCode } from "./QrCode";
import { SwitchMethodButton } from "./SwitchMethodButton";
import { useAttemptPolling } from "./useAttemptPolling";

type Props = {
  token: string;
  step: Extract<State, { kind: "pix" }>;
  send: (event: Event) => void;
  onLeave: () => void;
  isLeaving: boolean;
  leaveError: string | null;
};

const POLL_INTERVAL_MS = 3_000;

function secondsLeft(until: string | null, now: number): number | null {
  return until === null ? null : Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
}

export function PixStep({ token, step, send, onLeave, isLeaving, leaveError }: Props) {
  const { isRateLimited } = useAttemptPolling(token, step.paymentId, POLL_INTERVAL_MS, send);
  const [now, setNow] = useState(() => Date.now());
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const remaining = secondsLeft(step.expiresAt, now);
  // The clock decides, not the next poll: a QR past its time must not look payable for 3 more
  // seconds, or for as long as a rate limit pauses the polling.
  const isExpired = remaining === 0;

  async function regenerate() {
    setIsRegenerating(true);
    setRegenerateError(null);
    try {
      // The bank may still read the old one as pending; cancelling first frees the order's slot. A
      // refusal here means it is already over, which is what we want anyway.
      await cancelAttempt(token, step.paymentId).catch(() => undefined);
      const payment = await createAttempt(token, { method: "PIX" });
      send({ type: "attempt_created", payment });
    } catch (e) {
      setRegenerateError(messageFor(e));
      send(failureEvent(e));
    } finally {
      setIsRegenerating(false);
    }
  }

  if (isExpired) {
    return (
      <section>
        <h2
          data-step-heading
          tabIndex={-1}
          className="mb-2 font-display text-lg font-semibold outline-none"
        >
          Este Pix expirou
        </h2>
        <p className="text-sm text-muted">
          O código não pode mais ser pago. Gere um novo para continuar.
        </p>
        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={isRegenerating}
          onClick={() => void regenerate()}
        >
          {isRegenerating ? "Gerando…" : "Gerar novo Pix"}
        </Button>
        {regenerateError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {regenerateError}
          </p>
        )}
        <SwitchMethodButton onLeave={onLeave} isLeaving={isLeaving} error={leaveError} />
      </section>
    );
  }

  return (
    <section>
      <h2
        data-step-heading
        tabIndex={-1}
        className="mb-4 font-display text-lg font-semibold outline-none"
      >
        Pague com Pix
      </h2>
      <QrCode text={step.copiaECola} />
      <p className="mt-4 mb-3 rounded-xl bg-surface-muted p-3 font-mono text-xs break-all">
        {step.copiaECola}
      </p>
      <CopyButton text={step.copiaECola} />
      {remaining !== null && <Countdown remaining={remaining} />}
      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent" />
        Aguardando o pagamento…
      </p>
      {isRateLimited && (
        <p role="status" className="text-sm text-warn-fg">
          Muitas tentativas. Aguarde um instante.
        </p>
      )}
      <SwitchMethodButton onLeave={onLeave} isLeaving={isLeaving} error={leaveError} />
    </section>
  );
}

function Countdown({ remaining }: { remaining: number }) {
  const hours = Math.floor(remaining / 3600);
  const minutes = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  const clock = hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;

  return <p className="mt-3 text-sm text-muted tabular-nums">Expira em {clock}</p>;
}
