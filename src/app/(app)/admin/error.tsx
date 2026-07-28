"use client";

import { Button } from "@/components/ui";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-danger-line bg-danger-surface p-6">
        <h2 className="text-lg font-semibold text-ink">טעינת אזור הניהול נכשלה</h2>
        <p className="mt-1 text-sm text-muted">אירעה תקלה בטעינת הנתונים. ודאו שהחיבור תקין ונסו שוב.</p>
        <div className="mt-4">
          <Button onClick={reset}>נסה שוב</Button>
        </div>
      </div>
    </div>
  );
}
