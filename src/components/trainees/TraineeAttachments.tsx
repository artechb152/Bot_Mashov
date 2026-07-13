"use client";

import { useRef, useState } from "react";
import { Download, FileText, Paperclip, Trash2 } from "lucide-react";
import { Button, Panel } from "@/components/ui";
import type { AttachmentDTO } from "@/lib/data/attachments";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function TraineeAttachments({
  traineeId,
  initial,
}: {
  traineeId: string;
  initial: AttachmentDTO[];
}) {
  const [items, setItems] = useState<AttachmentDTO[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ""; // allow re-selecting the same file
    if (picked.length === 0) return;

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      picked.forEach((f) => fd.append("files", f));
      const res = await fetch(`/api/trainees/${traineeId}/attachments`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        attachments?: AttachmentDTO[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "העלאת הקבצים נכשלה.");
      } else {
        // Update the list in place — no navigation needed.
        setItems((prev) => [...(data.attachments ?? []), ...prev]);
      }
    } catch {
      setError("העלאת הקבצים נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(att: AttachmentDTO) {
    setError(null);
    try {
      const res = await fetch(`/api/trainees/${traineeId}/attachments/${att.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("מחיקת הקובץ נכשלה.");
        return;
      }
      setItems((prev) => prev.filter((a) => a.id !== att.id));
    } catch {
      setError("מחיקת הקובץ נכשלה. בדקו את החיבור ונסו שוב.");
    }
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">מסמכים מצורפים</h3>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={handleFiles}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          {uploading ? "מעלה…" : "העלאת קבצים"}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          אין עדיין מסמכים. ניתן לצרף מסמכי משוב, הערות או קבצים רלוונטיים (עד 5MB לקובץ).
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2"
            >
              <FileText className="h-5 w-5 shrink-0 text-subtle" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{att.originalName}</p>
                <p className="text-xs text-muted">
                  {formatSize(att.size)}
                  {att.uploadedAt ? ` · ${formatDate(att.uploadedAt)}` : ""}
                </p>
              </div>
              <a
                href={`/api/trainees/${traineeId}/attachments/${att.id}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
                aria-label={`הורדת ${att.originalName}`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(att)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
                aria-label={`מחיקת ${att.originalName}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
