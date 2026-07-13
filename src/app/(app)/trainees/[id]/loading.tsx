export default function TraineeDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl" aria-busy="true" aria-live="polite">
      <div className="rounded-xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">טוען…</p>
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
