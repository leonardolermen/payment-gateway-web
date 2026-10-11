import { HttpResponse } from "msw";

export function inProgress(): Response {
  return HttpResponse.json(
    {
      type: "urn:gateway:IN_PROGRESS",
      status: 409,
      detail: "a request with this Idempotency-Key is still being processed; retry in a moment",
    },
    { status: 409 },
  );
}

export function serverError(): Response {
  return HttpResponse.json({ type: "urn:gateway:INTERNAL", status: 500 }, { status: 500 });
}

/**
 * The gateway's Idempotency-Key rule (IdempotencyFilter): a 5xx is not an answer, so the key stays
 * IN_PROGRESS and every retry under it gets 409 until the TTL purge. `answer` sees only the
 * requests that run.
 */
export function withTheGatewayKeyRule(
  answer: (run: number) => Response,
): (key: string | null) => Response {
  const heldKeys = new Set<string>();
  let runs = 0;

  return (key) => {
    if (key !== null && heldKeys.has(key)) {
      return inProgress();
    }

    runs += 1;
    const response = answer(runs);
    if (key !== null && response.status >= 500) {
      heldKeys.add(key);
    }

    return response;
  };
}
