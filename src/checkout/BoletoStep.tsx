import { formatDate } from "../support/dates";
import type { Event, State } from "./checkoutState";
import { CopyButton } from "./CopyButton";
import { SwitchMethodButton } from "./SwitchMethodButton";
import { useAttemptPolling } from "./useAttemptPolling";

type Props = {
  token: string;
  step: Extract<State, { kind: "boleto" }>;
  send: (event: Event) => void;
  onLeave: () => void;
  isLeaving: boolean;
  leaveError: string | null;
};

// A boleto settles in days, not seconds; polling as fast as Pix would only burn the rate limit.
const POLL_INTERVAL_MS = 30_000;

export function BoletoStep({ token, step, send, onLeave, isLeaving, leaveError }: Props) {
  const { isRateLimited } = useAttemptPolling(token, step.paymentId, POLL_INTERVAL_MS, send);

  return (
    <section>
      <h2
        data-step-heading
        tabIndex={-1}
        className="mb-4 font-display text-lg font-semibold outline-none"
      >
        Pague com boleto
      </h2>
      <p className="text-xs tracking-wider text-muted uppercase">Linha digitável</p>
      <p className="mt-1 mb-3 rounded-xl bg-surface-muted p-3 font-mono text-xs break-all">
        {step.linhaDigitavel}
      </p>
      <CopyButton text={step.linhaDigitavel} />
      <p className="mt-3 text-sm text-muted">Vencimento: {formatDate(step.dueDate)}</p>
      {isRateLimited && (
        <p role="status" className="text-sm text-warn-fg">
          Muitas tentativas. Aguarde um instante.
        </p>
      )}
      <SwitchMethodButton onLeave={onLeave} isLeaving={isLeaving} error={leaveError} />
    </section>
  );
}
