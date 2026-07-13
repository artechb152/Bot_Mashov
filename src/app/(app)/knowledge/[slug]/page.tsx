import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses, PageHeader, Panel } from "@/components/ui";
import { KnowledgeMarkdown } from "@/components/knowledge/KnowledgeMarkdown";
import { getKnowledgeDocument } from "@/lib/data/knowledge";
import { getKnowledgeEntryBySlug } from "@/lib/knowledge/content";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const doc = await getKnowledgeDocument(slug).catch(() => null);
  return { title: doc && doc.visibility !== "internal" ? doc.title : "מסמך ידע" };
}

const STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  draft: "טיוטה",
  example: "דוגמה",
  archived: "בארכיון",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function KnowledgeDocPage({ params }: PageProps) {
  const { slug } = await params;

  // Metadata comes from MongoDB (the synced index); the body is read from the
  // source Markdown file.
  const doc = await getKnowledgeDocument(slug);
  // Internal docs (system prompt / config / guardrails) are never shown to users,
  // even via a direct URL.
  if (!doc || doc.visibility === "internal") notFound();
  const entry = await getKnowledgeEntryBySlug(slug);
  const body = entry?.body ?? "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={doc.title}
        description={doc.description || undefined}
        actions={
          <Link href="/knowledge" className={buttonClasses({ variant: "secondary" })}>
            חזרה למאגר
          </Link>
        }
      />

      <Panel>
        <h3 className="text-sm font-semibold text-ink">פרטי המסמך</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted">קטגוריה:</dt>
            <dd className="text-ink">{doc.category || "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">יחידה:</dt>
            <dd className="text-ink">{doc.unit || "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">סטטוס:</dt>
            <dd className="text-ink">{STATUS_LABELS[doc.status] ?? doc.status ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">סונכרן:</dt>
            <dd className="text-ink tabular-nums">{formatDate(doc.syncedAt)}</dd>
          </div>
          <div className="flex items-start gap-2 sm:col-span-2">
            <dt className="shrink-0 text-muted">תגיות:</dt>
            <dd>
              {doc.tags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-line px-1.5 py-0.5 text-xs text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-ink">—</span>
              )}
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel>
        {body ? (
          <KnowledgeMarkdown>{body}</KnowledgeMarkdown>
        ) : (
          <p className="text-sm text-muted">
            תוכן המסמך אינו זמין (ייתכן שקובץ המקור הוסר מהתיקייה knowledge/).
          </p>
        )}
      </Panel>

      <div>
        <Link href="/knowledge" className={buttonClasses({ variant: "secondary" })}>
          חזרה למאגר הידע
        </Link>
      </div>
    </div>
  );
}
