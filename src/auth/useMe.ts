import { useQuery } from "@tanstack/react-query";
import { getMe, meKeys } from "./authApi";

export function useMe() {
  return useQuery({ queryKey: meKeys.me, queryFn: getMe, staleTime: 60_000 });
}
