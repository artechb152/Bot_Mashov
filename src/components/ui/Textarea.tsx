import { cn } from "@/lib/cn";

export type TextareaProps = React.ComponentPropsWithoutRef<"textarea">;

/** Styled multi-line input. Pair with a `<label htmlFor>` for accessibility. */
export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink",
        "placeholder:text-subtle transition-colors",
        "focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
