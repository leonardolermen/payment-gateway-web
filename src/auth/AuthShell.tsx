import type { ReactNode } from "react";
import { Card } from "../support/ui/Card";
import { ThemeToggle } from "../support/ui/ThemeToggle";

type Props = { title: string; children: ReactNode; footer?: ReactNode };

export function AuthShell({ title, children, footer }: Props) {
  return (
    <main className="min-h-screen bg-bg px-4 pt-20 text-ink">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="size-9 shrink-0 rounded-[10px] bg-accent" />
          <div className="min-w-0">
            <p className="font-chrome text-[11px] font-semibold tracking-wider text-muted uppercase">
              Payment Gateway
            </p>
            <h1 className="font-display text-2xl font-semibold">{title}</h1>
          </div>
          <span className="ml-auto">
            <ThemeToggle />
          </span>
        </div>

        <Card>{children}</Card>

        {footer && <div className="flex justify-center gap-4 text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}

export const AUTH_LINK_CLASSES = "underline underline-offset-2 hover:text-ink";
