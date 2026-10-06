import type { ReactNode } from "react";

export function PageHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="min-w-0 font-display text-[22px] font-semibold break-words text-ink">
        {title}
      </h1>
      {action}
    </div>
  );
}
