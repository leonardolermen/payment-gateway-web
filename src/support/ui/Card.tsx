import type { ComponentProps } from "react";

export function Card({ className = "", ...div }: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-card border border-line bg-surface p-5 shadow-sm ${className}`}
      {...div}
    />
  );
}
