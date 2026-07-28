"use client";

import { useEffect, useState } from "react";
import { Button, Panel } from "@/components/ui";

type Grant = { id: string; granteeUserId: string; granteeName: string; permission: "view" | "edit" };

export function GrantsPanel({ traineeId }: { traineeId: string }) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/trainees/${traineeId}/grants`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.grants) setGrants(d.grants);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [traineeId]);

  async function revoke(id: string) {
    await fetch(`/api/admin/trainees/${traineeId}/grants/${id}`, { method: "DELETE" }).catch(() => {});
    setGrants((prev) => prev.filter((g) => g.id !== id));
  }

  if (!loaded) return null;

  return (
    <Panel>
      <h3 className="mb-3 text-sm font-semibold text-ink">הרשאות גישה שניתנו</h3>
      {grants.length === 0 ? (
        <p className="text-sm text-muted">לא ניתנו הרשאות גישה לתיק זה.</p>
      ) : (
        <ul className="space-y-2">
          {grants.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">
                {g.granteeName} · {g.permission === "edit" ? "עריכה" : "צפייה"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => revoke(g.id)}>ביטול הרשאה</Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
