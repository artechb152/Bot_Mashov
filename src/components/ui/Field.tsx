import { cn } from "@/lib/cn";

export type FieldProps = {
  label: string;
  /** Must match the id of the control rendered as `children`. */
  htmlFor: string;
  required?: boolean;
  /** Short helper text shown next to the label (e.g. "לא חובה", "שורה לכל פריט"). */
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

/** Labelled form field wrapper — keeps every form control accessible and consistent. */
export function Field({ label, htmlFor, required, hint, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
        <span>{label}</span>
        {required ? (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
        {hint ? <span className="text-xs font-normal text-subtle">· {hint}</span> : null}
      </label>
      {children}
    </div>
  );
}
