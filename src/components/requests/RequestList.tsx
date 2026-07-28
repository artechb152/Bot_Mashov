import Link from "next/link";
import { Panel, Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui";
import { ACCESS_REQUEST_STATUS_LABELS, type AccessRequestStatus } from "@/lib/domain/types";

type Req = {
  id: string;
  requestTypeLabel: string;
  requesterName: string;
  status: AccessRequestStatus;
  targetSummary: string;
  createdAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

export function RequestList({ requests, showRequester }: { requests: Req[]; showRequester?: boolean }) {
  if (requests.length === 0) {
    return (
      <Panel>
        <EmptyState title="אין בקשות" description="אין בקשות להצגה." />
      </Panel>
    );
  }
  return (
    <Panel className="p-0">
      <Table>
        <THead>
          <TR>
            <TH>סוג</TH>
            {showRequester ? <TH>מבקש</TH> : null}
            <TH>יעד</TH>
            <TH>סטטוס</TH>
            <TH>תאריך</TH>
            <TH><span className="sr-only">פעולות</span></TH>
          </TR>
        </THead>
        <TBody>
          {requests.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium">{r.requestTypeLabel}</TD>
              {showRequester ? <TD className="text-muted">{r.requesterName}</TD> : null}
              <TD className="text-muted">{r.targetSummary || "—"}</TD>
              <TD className="text-muted">{ACCESS_REQUEST_STATUS_LABELS[r.status]}</TD>
              <TD className="text-muted tabular-nums">{formatDate(r.createdAt)}</TD>
              <TD className="text-end">
                <Link href={`/requests/${r.id}`} className="text-sm font-medium text-ink hover:underline">פרטים</Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Panel>
  );
}
