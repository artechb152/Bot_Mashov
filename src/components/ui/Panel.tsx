import { cn } from "@/lib/cn";

export type PanelProps = React.ComponentPropsWithoutRef<"div"> & {
  /** Apply the standard inner padding. Set false for flush content (e.g. a table). */
  padded?: boolean;
};

/**
 * The single surface primitive — a bordered white container. Used sparingly:
 * prefer a Panel over scattering many small cards (see DESIGN.md).
 */
export function Panel({ className, padded = true, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface",
        padded && "p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}
