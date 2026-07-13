import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  title: string;
  description?: string;
  /** Optional functional icon (e.g. the module's icon). */
  icon?: LucideIcon;
  /** Optional action, typically a Button. */
  action?: React.ReactNode;
  className?: string;
};

/** Restrained empty / "in progress" state used across modules. */
export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
