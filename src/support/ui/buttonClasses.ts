export type ButtonVariant = "primary" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:opacity-90",
  ghost: "border border-line bg-surface text-ink hover:border-accent hover:text-accent",
  danger: "bg-danger text-white hover:opacity-90",
  // A destructive action that still needs a confirmation step: it warns without shouting.
  "danger-ghost": "border border-danger bg-surface text-danger hover:opacity-80",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs font-semibold",
  md: "px-4 py-2 text-sm",
  lg: "w-full px-5 py-3 text-base",
};

// Only opacity animates. A colour transition also fires when data-theme swaps the --accent the
// background reads, and while the tab is hidden (a background tab, an undrawn preview pane) the
// animation clock does not advance: the button kept the old theme's teal at currentTime 0 until
// the next visible frame. A theme switch should be instant anyway.
// Exported apart from <Button> so a router <Link> can look like one without becoming a <button>.
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-opacity",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
  ].join(" ");
}
