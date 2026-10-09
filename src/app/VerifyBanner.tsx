import { useMutation } from "@tanstack/react-query";
import { resendVerification } from "../auth/authApi";
import type { Me } from "../auth/types";
import { messageFor } from "../support/gatewayError";

export function VerifyBanner({ me }: { me: Me }) {
  const resend = useMutation({ mutationFn: resendVerification });

  if (me.onboarding.email_verified) {
    return null;
  }

  return (
    <div className="bg-warn-bg px-4 py-2 text-sm text-warn-fg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span>Confirme seu e-mail para ativar o ambiente de produção.</span>
        <button
          type="button"
          onClick={() => resend.mutate()}
          disabled={resend.isPending || resend.isSuccess}
          className="font-semibold underline disabled:no-underline"
        >
          {resend.isSuccess ? "Enviado" : "Reenviar e-mail"}
        </button>
        {resend.isError && <span role="alert">{messageFor(resend.error)}</span>}
      </div>
    </div>
  );
}
