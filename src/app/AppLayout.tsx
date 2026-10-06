import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router";
import { clearApiKey } from "../auth/apiKey";
import { useMerchant } from "../auth/useMerchant";

const BADGE = {
  TEST: "bg-amber-100 text-amber-800",
  LIVE: "bg-green-100 text-green-800",
};

export function AppLayout() {
  const merchant = useMerchant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  function signOut() {
    clearApiKey();
    // The cache belongs to the merchant that just left.
    queryClient.clear();
    navigate("/app/login", { replace: true });
  }

  return (
    <div>
      <header className="flex items-center gap-4 border-b px-4 py-2">
        <strong>{merchant.data?.name ?? "…"}</strong>
        {merchant.data && (
          <span className={`rounded px-2 py-0.5 text-xs ${BADGE[merchant.data.environment]}`}>
            {merchant.data.environment}
          </span>
        )}
        <nav className="ml-4 flex gap-3">
          <NavLink to="/app/orders">Cobranças</NavLink>
          <NavLink to="/app/customers">Clientes</NavLink>
        </nav>
        <button type="button" onClick={signOut} className="ml-auto">
          Sair
        </button>
      </header>
      <Outlet />
    </div>
  );
}
