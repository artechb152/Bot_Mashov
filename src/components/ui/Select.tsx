import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectProps = React.ComponentPropsWithoutRef<"select">;

/**
 * Styled native select. The chevron sits on the inline-end (left in RTL); the
 * native arrow is removed with `appearance-none` and `pe-9` reserves its space.
 */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-line-strong bg-surface ps-3 pe-9 text-sm text-ink",
          "transition-colors focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-subtle"
        aria-hidden="true"
      />
    </div>
  );
}
