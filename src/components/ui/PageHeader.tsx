import { cn } from "@/lib/cn";

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Optional actions (e.g. a primary Button) shown on the inline-end. */
  actions?: React.ReactNode;
  className?: string;
};

/** Consistent page title block used at the top of every module screen. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
