import type { ReactNode } from "react";

export type BadgeTone = "ok" | "warn" | "neutral" | "danger";

const TONES: Record<BadgeTone, string> = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg",
  neutral: "bg-neutral-bg text-neutral-fg",
  danger: "bg-neutral-bg text-danger",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
