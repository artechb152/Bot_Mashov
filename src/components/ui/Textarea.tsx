import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = React.ComponentPropsWithoutRef<"textarea">;

/** Styled multi-line input. Pair with a `<label htmlFor>` for accessibility. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-lg border border-control bg-surface px-3 py-2 text-base leading-relaxed text-ink sm:text-sm",
        "placeholder:text-subtle transition-colors",
        "focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
