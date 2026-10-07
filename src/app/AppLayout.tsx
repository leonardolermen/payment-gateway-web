import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router";
import { clearApiKey } from "../auth/apiKey";
import { useMerchant } from "../auth/useMerchant";
import { Badge, type BadgeTone } from "../support/ui/Badge";
import { ThemeToggle } from "../support/ui/ThemeToggle";

const ENVIRONMENT_TONE: Record<"TEST" | "LIVE", BadgeTone> = { TEST: "warn", LIVE: "ok" };

// The active item is marked by a bar under the text, as in the approved mockup; the bar is a
// border so the label does not shift when it moves between items.
function navClass({ isActive }: { isActive: boolean }): string {
  return `flex h-full items-center border-b-2 font-medium ${
    isActive ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
  }`;
}

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
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line bg-surface font-chrome text-[13px]">
        <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="size-[22px] shrink-0 rounded-[7px] bg-accent" />
            <strong className="truncate font-bold">{merchant.data?.name ?? "…"}</strong>
          </div>
          <nav className="flex h-full gap-4">
            <NavLink to="/app/orders" className={navClass}>
              Cobranças
            </NavLink>
            <NavLink to="/app/subscriptions" className={navClass}>
              Assinaturas
            </NavLink>
            <NavLink to="/app/customers" className={navClass}>
              Clientes
            </NavLink>
            <NavLink to="/app/settings/installments" className={navClass}>
              Parcelamento
            </NavLink>
          </nav>
          <div className="flex items-center justify-end gap-2">
            {merchant.data && (
              <Badge tone={ENVIRONMENT_TONE[merchant.data.environment]}>
                {merchant.data.environment}
              </Badge>
            )}
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="rounded-pill px-2 py-1 text-xs font-semibold text-muted hover:text-accent"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
