import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { onUnauthenticated } from "../support/merchantRequest";
import { readApiKey } from "./apiKey";

function loginPath(pathname: string): string {
  return "/app/login?next=" + encodeURIComponent(pathname);
}

export function RequireApiKey() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // A 401 can arrive from any request after render; the key is already cleared by then.
  // The cache is cleared too: the next login may be another merchant and must not see this one's data.
  useEffect(
    () =>
      onUnauthenticated(() => {
        queryClient.clear();
        navigate(loginPath(location.pathname), { replace: true });
      }),
    [navigate, queryClient, location.pathname],
  );

  if (!readApiKey()) {
    return <Navigate to={loginPath(location.pathname)} replace />;
  }

  return <Outlet />;
}
