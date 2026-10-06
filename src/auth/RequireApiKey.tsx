import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { onUnauthenticated } from "../support/merchantRequest";
import { readApiKey } from "./apiKey";

function loginPath(pathname: string): string {
  return "/app/login?next=" + encodeURIComponent(pathname);
}

export function RequireApiKey() {
  const location = useLocation();
  const navigate = useNavigate();

  // A 401 can arrive from any request after render; the key is already cleared by then.
  useEffect(
    () => onUnauthenticated(() => navigate(loginPath(location.pathname), { replace: true })),
    [navigate, location.pathname],
  );

  if (!readApiKey()) {
    return <Navigate to={loginPath(location.pathname)} replace />;
  }

  return <Outlet />;
}
