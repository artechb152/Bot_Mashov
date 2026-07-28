import { Panel } from "@/components/ui";

/**
 * A restrained overview strip: one Panel holding a row of figures, each a large
 * tabular-nums value over a small muted label, separated by hairline borders.
 *
 * This is deliberately NOT a grid of individual stat cards — DESIGN.md forbids
 * "כרטיסייה לכל פיסת מידע". One surface, several figures.
 */
export type Stat = { label: string; value: number };

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <Panel padded={false}>
      <dl className="grid grid-cols-2 divide-y divide-line sm:flex sm:divide-y-0">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={
              "flex flex-col gap-1 px-5 py-4 sm:flex-1" +
              // Hairline separators between figures (inline-end border, RTL-safe),
              // except after the last one.
              (i < stats.length - 1 ? " sm:border-e sm:border-line" : "")
            }
          >
            <dd className="text-2xl font-semibold tabular-nums text-ink">{s.value}</dd>
            <dt className="text-xs font-medium text-muted">{s.label}</dt>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
