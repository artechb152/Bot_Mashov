import { cn } from "@/lib/cn";

export type InputProps = React.ComponentPropsWithoutRef<"input">;

/** Styled text input. Pair with a `<label htmlFor>` for accessibility. */
export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink",
        "placeholder:text-subtle transition-colors",
        "focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
