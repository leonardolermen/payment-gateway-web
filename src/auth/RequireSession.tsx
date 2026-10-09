import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { onUnauthenticated, refreshSession } from "../support/merchantRequest";
import { readAccessToken } from "./session";

type Bootstrap = "pending" | "signedIn" | "signedOut";

// The access token lives in memory, so a reload starts without one: the refresh cookie is the
// only way back in, and it is tried once before deciding the visitor has to log in.
export function RequireSession() {
  const [bootstrap, setBootstrap] = useState<Bootstrap>(() =>
    readAccessToken() ? "signedIn" : "pending",
  );
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const loginPath = "/login?next=" + encodeURIComponent(pathname);

  useEffect(() => {
    if (bootstrap !== "pending") {
      return;
    }

    let isMounted = true;
    void refreshSession().then((restored) => {
      if (isMounted) {
        setBootstrap(restored ? "signedIn" : "signedOut");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [bootstrap]);

  // A session that dies mid-visit: the cache belongs to whoever was signed in.
  useEffect(
    () =>
      onUnauthenticated(() => {
        queryClient.clear();
        navigate(loginPath, { replace: true });
      }),
    [queryClient, navigate, loginPath],
  );

  if (bootstrap === "pending") {
    return <p className="p-6 text-sm text-muted">Carregando…</p>;
  }

  if (bootstrap === "signedOut") {
    return <Navigate to={loginPath} replace />;
  }

  return <Outlet />;
}
