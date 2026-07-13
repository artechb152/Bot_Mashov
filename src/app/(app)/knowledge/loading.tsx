import { PageHeader } from "@/components/ui";

export default function KnowledgeLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="מאגר ידע"
        description="מסמכי הידע מנוהלים כקבצי Markdown בתיקייה knowledge/ ומסונכרנים למסד הנתונים."
      />
      <div className="rounded-xl border border-line bg-surface p-6" aria-busy="true" aria-live="polite">
        <p className="text-sm text-muted">טוען מסמכי ידע…</p>
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
