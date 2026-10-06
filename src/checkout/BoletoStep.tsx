import { formatDate } from "../support/dates";
import type { Event, State } from "./checkoutState";
import { CopyButton } from "./CopyButton";
import { SwitchMethodButton } from "./SwitchMethodButton";
import { useAttemptPolling } from "./useAttemptPolling";

type Props = {
  token: string;
  step: Extract<State, { kind: "boleto" }>;
  send: (event: Event) => void;
};

// A boleto settles in days, not seconds; polling as fast as Pix would only burn the rate limit.
const POLL_INTERVAL_MS = 30_000;

export function BoletoStep({ token, step, send }: Props) {
  const { isRateLimited } = useAttemptPolling(token, step.paymentId, POLL_INTERVAL_MS, send);

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Pague com boleto</h2>
      <p className="text-sm text-gray-600">Linha digitável</p>
      <p className="break-all font-mono text-sm">{step.linhaDigitavel}</p>
      <CopyButton text={step.linhaDigitavel} />
      <p className="mt-2">Vencimento: {formatDate(step.dueDate)}</p>
      {isRateLimited && <p role="status">Muitas tentativas. Aguarde um instante.</p>}
      <SwitchMethodButton token={token} paymentId={step.paymentId} send={send} />
    </section>
  );
}
