import { Drama } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "נע״ת" };

export default function ScenariosPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="נע״ת"
        description="ניהול תרחישי נע״ת ומשחקי תפקידים לתרגול מצבים."
      />
      <EmptyState
        icon={Drama}
        title="המודול בבנייה"
        description="ניהול תרחישי הנע״ת ומשחקי התפקידים יתווסף בשלב הבא של הפיתוח."
      />
    </div>
  );
}
