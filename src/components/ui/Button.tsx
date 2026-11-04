import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink hover:bg-primary-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  /** Low-emphasis secondary action in a header/toolbar (muted text, no border). */
  quiet: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "border border-line-strong bg-surface text-danger hover:bg-danger-surface",
};

const sizeClasses: Record<Size, string> = {
  // 40px minimum on desktop, 44px on touch-first phones for the default size.
  sm: "h-10 px-3 text-sm",
  md: "h-11 px-4 text-sm sm:h-10",
};

/**
 * The shared button class string. Exported so a Next.js `<Link>` can be styled
 * as a button (a navigational action) without duplicating styles or nesting
 * `<a>` inside `<button>`.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  variant?: Variant;
  size?: Size;
};

/** Primary action element. Defaults to the solid action-blue button (`primary`) — one per view. */
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...props} />
  );
}
