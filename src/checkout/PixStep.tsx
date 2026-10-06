import { useEffect, useState } from "react";
import type { Event, State } from "./checkoutState";
import { CopyButton } from "./CopyButton";
import { QrCode } from "./QrCode";
import { SwitchMethodButton } from "./SwitchMethodButton";
import { useAttemptPolling } from "./useAttemptPolling";

type Props = {
  token: string;
  step: Extract<State, { kind: "pix" }>;
  send: (event: Event) => void;
};

const POLL_INTERVAL_MS = 3_000;

export function PixStep({ token, step, send }: Props) {
  const { isRateLimited } = useAttemptPolling(token, step.paymentId, POLL_INTERVAL_MS, send);

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Pague com Pix</h2>
      <QrCode text={step.copiaECola} />
      <p className="mt-4 break-all font-mono text-sm">{step.copiaECola}</p>
      <CopyButton text={step.copiaECola} />
      {step.expiresAt && <Countdown until={step.expiresAt} />}
      <p className="mt-2 text-sm text-gray-600">Aguardando o pagamento…</p>
      {isRateLimited && <p role="status">Muitas tentativas. Aguarde um instante.</p>}
      <SwitchMethodButton token={token} paymentId={step.paymentId} send={send} />
    </section>
  );
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
  if (remaining === 0) {
    return <p className="mt-2">Este código Pix expirou.</p>;
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  const clock = hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;

  return <p className="mt-2">Expira em {clock}</p>;
}
