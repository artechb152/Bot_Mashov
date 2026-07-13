import { ClipboardList } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "ניתוח משוב" };

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="ניתוח משוב"
        description="איסוף וניתוח משובים, זיהוי מגמות והפקת תובנות לפעולה."
      />
      <EmptyState
        icon={ClipboardList}
        title="המודול בבנייה"
        description="איסוף המשובים והניתוח שלהם יתווספו בשלב הבא של הפיתוח."
      />
    </div>
  );
}
