import { PageHeader } from "@/components/ui";

export default function TraineesLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="חניכים"
        description="ניהול רשומות החניכים ומעקב ההתקדמות שלהם."
      />
      <div className="rounded-xl border border-line bg-surface p-6" aria-busy="true" aria-live="polite">
        <p className="text-sm text-muted">טוען חניכים…</p>
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
