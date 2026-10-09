import type { ReactNode } from "react";
import { Card } from "./Card";

type Props = { selected: boolean; left: ReactNode; children: ReactNode };

// The panel's two-column frame, as in the approved mockup: list (and form) on the left, the
// selected item on the right. One column below 1024px, with the selected item first so a tap on
// a row shows it without scrolling past the list.
export function Workspace({ selected, left, children }: Props) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
      <div className="min-w-0 space-y-5">{left}</div>

      <div className={`min-w-0 ${selected ? "order-first lg:order-none" : ""}`}>{children}</div>
    </div>
  );
}

export function WorkspaceEmpty({ children }: { children: ReactNode }) {
  return (
    // Only beside the list: on a phone it would sit alone under the form.
    <Card className="hidden text-sm text-muted lg:block">{children}</Card>
  );
}
