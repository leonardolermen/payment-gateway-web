import { useQuery } from "@tanstack/react-query";
import { getMerchant } from "./merchantApi";

// The query key is constant on purpose: the API key must never end up in cache keys or devtools.
export function useMerchant() {
  return useQuery({ queryKey: ["merchant"], queryFn: () => getMerchant() });
}
