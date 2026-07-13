import { PageHeader } from "@/components/ui";
import { TraineeForm } from "@/components/trainees/TraineeForm";

export const metadata = { title: "הוספת חניך" };

export default function NewTraineePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="הוספת חניך"
        description="הזינו את פרטי החניך. בחוזקות ובחולשות — כל שורה נשמרת כפריט נפרד."
      />
      <TraineeForm mode="create" />
    </div>
  );
}
