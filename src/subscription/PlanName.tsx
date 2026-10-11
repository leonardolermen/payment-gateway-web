import { useQuery } from "@tanstack/react-query";
import { getPlan, planKeys } from "../plan/planApi";

// One request per plan however many rows share it: the rows ask the cache, not the API. A plan
// edit invalidates planKeys.all, so never going stale on its own does not hide a rename.
export function PlanName({ planId }: { planId: string }) {
  const plan = useQuery({
    queryKey: planKeys.detail(planId),
    queryFn: () => getPlan(planId),
    staleTime: Infinity,
  });

  // The id while it loads or if the plan cannot be read: the row still says which plan it is.
  return <>{plan.data?.name ?? planId}</>;
}
