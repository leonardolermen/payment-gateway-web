import { useQueryClient } from "@tanstack/react-query";
import { storeEnvironment, type Environment } from "../auth/environment";
import type { Me } from "../auth/types";
import { useEnvironment } from "./useEnvironment";

const SELECTED_CLASS: Record<Environment, string> = {
  TEST: "bg-warn-bg text-warn-fg",
  LIVE: "bg-ok-bg text-ok-fg",
};

const ENVIRONMENTS: Environment[] = ["TEST", "LIVE"];

export function EnvironmentSwitch({ me }: { me: Me }) {
  const environment = useEnvironment();
  const queryClient = useQueryClient();
  const isLiveLocked = !me.onboarding.email_verified;

  function choose(next: Environment) {
    storeEnvironment(next);
    // Cached TEST lists must not show up under LIVE, or the other way round.
    queryClient.clear();
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
