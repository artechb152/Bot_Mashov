import { cn } from "@/lib/cn";

/**
 * Thin styled table primitives. `Table` wraps the element in a horizontally
 * scrollable, bordered container so wide tables stay usable on small screens.
 * Cells align to the inline-start (`text-start`) for correct RTL behaviour.
 */
export function Table({ className, ...props }: React.ComponentPropsWithoutRef<"table">) {
  return (
    <div className="relative w-full overflow-x-auto rounded-xl border border-line">
      <table className={cn("w-full border-collapse text-start text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.ComponentPropsWithoutRef<"thead">) {
  return <thead className={cn("border-b border-line bg-surface-2", className)} {...props} />;
}

export function TBody({ className, ...props }: React.ComponentPropsWithoutRef<"tbody">) {
  return <tbody className={cn("divide-y divide-line", className)} {...props} />;
}

export function TR({ className, ...props }: React.ComponentPropsWithoutRef<"tr">) {
  return <tr className={cn("bg-surface transition-colors hover:bg-surface-2", className)} {...props} />;
}

export function TH({ className, ...props }: React.ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={cn("whitespace-nowrap px-4 py-3 text-start text-sm font-semibold text-muted", className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.ComponentPropsWithoutRef<"td">) {
  return <td className={cn("px-4 py-3 text-start align-middle text-ink", className)} {...props} />;
}
