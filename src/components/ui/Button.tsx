import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink hover:bg-slate-800",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "border border-line-strong bg-surface text-danger hover:bg-red-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
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
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
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

/** Primary action element. Defaults to a solid dark button (`primary`). */
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
