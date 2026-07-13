import { Target } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "תרגיל מסכם" };

export default function FinalExercisePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="תרגיל מסכם"
        description="תכנון, ניהול והערכה של התרגיל המסכם בסיום ההדרכה."
      />
      <EmptyState
        icon={Target}
        title="המודול בבנייה"
        description="תכנון התרגיל המסכם וההערכה שלו יתווספו בשלב הבא של הפיתוח."
      />
    </div>
  );
}
