import { MonitorPlay } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "סימולציות" };

export default function SimulationsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="סימולציות"
        description="מאגר תרחישים והמלצה מותאמת לכל חניך ולכל שלב בהדרכה."
      />
      <EmptyState
        icon={MonitorPlay}
        title="המודול בבנייה"
        description="מאגר הסימולציות וההמלצות המותאמות יתווספו בשלב הבא של הפיתוח."
      />
    </div>
  );
}
