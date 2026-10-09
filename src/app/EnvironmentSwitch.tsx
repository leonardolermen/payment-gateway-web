import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { meKeys } from "../auth/authApi";
import { readEnvironment, storeEnvironment, type Environment } from "../auth/environment";
import type { Me } from "../auth/types";
import { useEnvironment } from "./useEnvironment";

const SELECTED_CLASS: Record<Environment, string> = {
  TEST: "bg-warn-bg text-warn-fg",
  LIVE: "bg-ok-bg text-ok-fg",
};

const ENVIRONMENTS: Environment[] = ["TEST", "LIVE"];

function switchTo(queryClient: QueryClient, next: Environment) {
  storeEnvironment(next);
  // Cached TEST lists must not show up under LIVE, or the other way round. `me` is the same in
  // both, and dropping it would unmount the header while it refetches.
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meKeys.me[0] });
}

export function EnvironmentSwitch({ me }: { me: Me }) {
  const environment = useEnvironment();
  const queryClient = useQueryClient();
  const isLiveLocked = !me.user.email_verified;

  // A LIVE choice left in storage (another user, or before verification lapsed) must not stick to
  // someone who cannot use it. UX only: the gateway already refuses LIVE with 403 EMAIL_NOT_VERIFIED.
  useEffect(() => {
    if (isLiveLocked && readEnvironment() === "LIVE") {
      switchTo(queryClient, "TEST");
    }
  }, [isLiveLocked, queryClient]);

  function choose(next: Environment) {
    switchTo(queryClient, next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Ambiente"
      className="flex rounded-pill border border-line p-0.5 text-xs font-semibold"
    >
      {ENVIRONMENTS.map((option) => {
        const isSelected = option === environment;
        const isLocked = option === "LIVE" && isLiveLocked;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isLocked}
            title={isLocked ? "Confirme seu e-mail para usar produção" : undefined}
            onClick={() => choose(option)}
            className={`rounded-pill px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected ? SELECTED_CLASS[option] : "text-muted"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
