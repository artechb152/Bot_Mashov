"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { EmptyState, Input, Panel, Select } from "@/components/ui";
import type { KnowledgeDocDTO } from "@/lib/data/knowledge";

const STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  draft: "טיוטה",
  example: "דוגמה",
  archived: "בארכיון",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "he"));
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function KnowledgeCard({ doc }: { doc: KnowledgeDocDTO }) {
  return (
    <Link
      href={`/knowledge/${doc.slug}`}
      className="group block rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink group-hover:underline">{doc.title}</h3>
        <ChevronLeft
          className="mt-1 h-4 w-4 shrink-0 text-subtle transition-transform group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
      </div>

      {doc.description ? (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{doc.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {doc.category ? <span>{doc.category}</span> : null}
        {doc.category && doc.unit ? <span aria-hidden="true">·</span> : null}
        {doc.unit ? <span>{doc.unit}</span> : null}
        {doc.status !== "active" ? (
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px]">
            {statusLabel(doc.status)}
          </span>
        ) : null}
      </div>

      {doc.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {doc.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export function KnowledgeExplorer({ docs }: { docs: KnowledgeDocDTO[] }) {
  const hasActive = docs.some((d) => d.status === "active");

  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState(hasActive ? "active" : "all");

  const units = useMemo(() => uniqueSorted(docs.map((d) => d.unit)), [docs]);
  const categories = useMemo(() => uniqueSorted(docs.map((d) => d.category)), [docs]);
  const statuses = useMemo(() => uniqueSorted(docs.map((d) => d.status)), [docs]);

  const activeDocs = useMemo(() => docs.filter((d) => d.status === "active"), [docs]);
  const stats = useMemo(
    () => ({
      documents: activeDocs.length,
      units: new Set(activeDocs.map((d) => d.unit).filter(Boolean)).size,
      categories: new Set(activeDocs.map((d) => d.category).filter(Boolean)).size,
    }),
    [activeDocs],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return docs
      .filter((d) => {
        if (status !== "all" && d.status !== status) return false;
        if (unit && d.unit !== unit) return false;
        if (category && d.category !== category) return false;
        if (q) {
          const haystack = `${d.title} ${d.description} ${d.tags.join(" ")}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          a.unit.localeCompare(b.unit, "he") ||
          a.order - b.order ||
          a.title.localeCompare(b.title, "he"),
      );
  }, [docs, status, unit, category, q]);

  if (docs.length === 0) {
    return (
      <EmptyState
        title="אין עדיין מסמכי ידע במסד הנתונים"
        description="הוסיפו קבצי Markdown בתיקייה knowledge/ והריצו סנכרון (npm run knowledge:sync) כדי שיופיעו כאן."
      />
    );
  }

  return (
    <div className="space-y-6">
      {!hasActive ? (
        <Panel className="border-danger-line bg-danger-surface">
          <p className="text-sm text-muted">
            מאגר הידע עדיין במצב דמו — אין מסמכים פעילים, רק מסמך דוגמה. הוסיפו קבצי ידע אמיתיים
            לתיקייה <span className="font-medium text-ink">knowledge/</span> והריצו סנכרון.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="מסמכים פעילים" value={stats.documents} />
        <StatCard label="יחידות" value={stats.units} />
        <StatCard label="קטגוריות" value={stats.categories} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-subtle"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש בשם, תיאור ותגיות…"
            aria-label="חיפוש מסמכי ידע"
            className="pe-9"
          />
        </div>

        <Select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="סינון לפי יחידה">
          <option value="">כל היחידות</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>

        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="סינון לפי קטגוריה"
        >
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="סינון לפי סטטוס"
        >
          <option value="all">כל הסטטוסים</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="לא נמצאו מסמכים" description="נסו לשנות את החיפוש או הסינון." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((doc) => (
            <KnowledgeCard key={doc.slug} doc={doc} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted">מוצגים {filtered.length} מתוך {docs.length} מסמכים</p>
    </div>
  );
}
