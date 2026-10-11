import { Outlet, useMatch } from "react-router";
import { Workspace } from "../support/ui/Workspace";
import { SubscriptionsList } from "./SubscriptionsList";

export function SubscriptionsWorkspace() {
  const selected = useMatch("/app/subscriptions/:id") !== null;

  return (
    <Workspace selected={selected} left={<SubscriptionsList />}>
      <Outlet />
    </Workspace>
  );
}
