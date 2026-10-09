import { useResendVerification } from "../auth/useResendVerification";
import type { Me } from "../auth/types";
import { messageFor } from "../support/gatewayError";

export function VerifyBanner({ me }: { me: Me }) {
  const resend = useResendVerification();

  if (me.user.email_verified) {
    return null;
  }

  return (
    <div className="bg-warn-bg px-4 py-2 text-sm text-warn-fg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span>Confirme seu e-mail para ativar o ambiente de produção.</span>
        <button
          type="button"
          onClick={resend.send}
          disabled={resend.status === "pending" || resend.status === "sent"}
          className="font-semibold underline disabled:no-underline"
        >
          {resend.status === "sent" ? "Enviado" : "Reenviar e-mail"}
        </button>
        {resend.status === "error" && (
          <span role="alert" className="text-danger">
            {messageFor(resend.error)}
          </span>
        )}
      </div>
    </div>
  );
}
