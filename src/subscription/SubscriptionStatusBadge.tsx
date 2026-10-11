import { Badge } from "../support/ui/Badge";
import { SUBSCRIPTION_STATUS } from "./subscriptionLabels";
import type { SubscriptionStatus } from "./types";

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const { label, tone } = SUBSCRIPTION_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
