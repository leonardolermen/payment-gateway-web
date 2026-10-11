import { useMutation } from "@tanstack/react-query";
import { resendVerification } from "./authApi";

export type ResendStatus = "idle" | "pending" | "sent" | "error";

const STATUS: Record<"idle" | "pending" | "success" | "error", ResendStatus> = {
  idle: "idle",
  pending: "pending",
  success: "sent",
  error: "error",
};

// One wrapper for the banner and the account card, so both read the same states the same way.
export function useResendVerification() {
  const resend = useMutation({ mutationFn: resendVerification });

  return { send: () => resend.mutate(), status: STATUS[resend.status], error: resend.error };
}
