import { Badge } from "../support/ui/Badge";
import { STATUS_LABELS, STATUS_TONES } from "./labels";
import type { SubscriptionStatus } from "./types";

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
