import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.ComponentPropsWithoutRef<"input">;

/** Styled text input. Pair with a `<label htmlFor>` for accessibility. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        // 16px on phones so iOS does not zoom the page on focus; 14px from `sm` up.
        "h-11 w-full rounded-lg border border-control bg-surface px-3 text-base text-ink sm:h-10 sm:text-sm",
        "placeholder:text-subtle transition-colors",
        "focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
