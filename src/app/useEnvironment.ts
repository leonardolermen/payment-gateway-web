import { useSyncExternalStore } from "react";
import { onEnvironmentChange, readEnvironment, type Environment } from "../auth/environment";

export function useEnvironment(): Environment {
  return useSyncExternalStore(onEnvironmentChange, readEnvironment);
}
