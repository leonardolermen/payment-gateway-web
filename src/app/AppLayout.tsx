import { useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router";
import { clearApiKey } from "../auth/apiKey";
import { useMerchant } from "../auth/useMerchant";
import { Badge, type BadgeTone } from "../support/ui/Badge";
import { Button } from "../support/ui/Button";
import { ThemeToggle } from "../support/ui/ThemeToggle";

const ENVIRONMENT_TONE: Record<"TEST" | "LIVE", BadgeTone> = { TEST: "warn", LIVE: "ok" };

function navClass({ isActive }: { isActive: boolean }): string {
  return `rounded-pill px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-surface-muted text-accent" : "text-muted hover:text-ink"
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
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="size-6 shrink-0 rounded-md bg-accent" />
            <strong className="truncate font-display text-lg">{merchant.data?.name ?? "…"}</strong>
            {merchant.data && (
              <Badge tone={ENVIRONMENT_TONE[merchant.data.environment]}>
                {merchant.data.environment}
              </Badge>
            )}
          </div>
          <nav className="flex gap-1">
            <NavLink to="/app/orders" className={navClass}>
              Cobranças
            </NavLink>
            <NavLink to="/app/customers" className={navClass}>
              Clientes
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
