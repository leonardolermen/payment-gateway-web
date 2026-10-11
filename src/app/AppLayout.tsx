import { NavLink, Outlet } from "react-router";
import { useMe } from "../auth/useMe";
import { ThemeToggle } from "../support/ui/ThemeToggle";
import { EnvironmentSwitch } from "./EnvironmentSwitch";
import { useEnvironment } from "./useEnvironment";
import { UserMenu } from "./UserMenu";
import { VerifyBanner } from "./VerifyBanner";

// The active item is marked by a bar under the text, as in the approved mockup; the bar is a
// border so the label does not shift when it moves between items.
function navClass({ isActive }: { isActive: boolean }): string {
  return `flex h-full items-center border-b-2 font-medium ${
    isActive ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
  }`;
}

export function AppLayout() {
  const me = useMe();
  const environment = useEnvironment();

  // The amber top line is the "you are in test" cue the spec asks for.
  const testCue = environment === "TEST" ? "border-t-2 border-warn-fg" : "";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className={`border-b border-line bg-surface font-chrome text-[13px] ${testCue}`}>
        <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="size-[22px] shrink-0 rounded-[7px] bg-accent" />
            <strong className="truncate font-bold">{me.data?.merchant.name ?? "…"}</strong>
          </div>
          <nav className="flex h-full gap-4">
            <NavLink to="/app/orders" className={navClass}>
              Cobranças
            </NavLink>
            <NavLink to="/app/customers" className={navClass}>
              Clientes
            </NavLink>
            <NavLink to="/app/plans" className={navClass}>
              Planos
            </NavLink>
            <NavLink to="/app/settings" className={navClass}>
              Configurações
            </NavLink>
          </nav>
          <div className="flex items-center justify-end gap-2">
            {me.data && <EnvironmentSwitch me={me.data} />}
            <ThemeToggle />
            {me.data && <UserMenu me={me.data} />}
          </div>
        </div>
      </header>
      {me.data && <VerifyBanner me={me.data} />}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
