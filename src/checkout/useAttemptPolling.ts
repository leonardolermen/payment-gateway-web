import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { GatewayRequestError } from "../support/gatewayError";
import { getAttempt } from "./checkoutApi";
import type { Event } from "./checkoutState";

const DEFAULT_RETRY_AFTER_SECONDS = 5;

/**
 * Polls one attempt and feeds each answer to the reducer as "polled". A 429 stops the interval
 * for Retry-After seconds instead of letting it keep firing: polling through a rate limit only
 * extends the limit, and the payer would stare at a spinner that never resolves.
 */
export function useAttemptPolling(
  token: string,
  paymentId: string,
  intervalMs: number,
  send: (event: Event) => void,
): { isRateLimited: boolean } {
  // The error that was already waited out; derived instead of mirrored in state so a stale 429
  // cannot pause polling a second time while its retry is still in flight.
  const [waitedOutErrorAt, setWaitedOutErrorAt] = useState(0);
  const attempt = useQuery({
    queryKey: ["attempt", token, paymentId],
    queryFn: () => getAttempt(token, paymentId),
    refetchInterval: (query) =>
      retryAfterOf(query.state.error) !== null && query.state.errorUpdatedAt > waitedOutErrorAt
        ? false
        : intervalMs,
    retry: false,
  });

  useEffect(() => {
    if (attempt.data) {
      send({ type: "polled", payment: attempt.data });
    }
    // dataUpdatedAt so an identical PENDING answer still counts as a poll.
  }, [attempt.dataUpdatedAt, attempt.data, send]);

  const { error, errorUpdatedAt, refetch } = attempt;
  const retryAfterSeconds = retryAfterOf(error);
  const isRateLimited = retryAfterSeconds !== null && errorUpdatedAt > waitedOutErrorAt;

  useEffect(() => {
    if (retryAfterSeconds === null || !isRateLimited) {
      return;
    }

    const timer = setTimeout(() => {
      setWaitedOutErrorAt(errorUpdatedAt);
      void refetch();
    }, retryAfterSeconds * 1000);

    return () => clearTimeout(timer);
  }, [retryAfterSeconds, isRateLimited, errorUpdatedAt, refetch]);

  return { isRateLimited };
}

function retryAfterOf(error: Error | null): number | null {
  if (error instanceof GatewayRequestError && error.error.code === "RATE_LIMITED") {
    return error.error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS;
  }

  return null;
}
