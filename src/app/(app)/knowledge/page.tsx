import { PageHeader } from "@/components/ui";
import { KnowledgeExplorer } from "@/components/knowledge/KnowledgeExplorer";
import { listKnowledgeDocuments } from "@/lib/data/knowledge";

export const metadata = { title: "מקורות הבוט" };

// Reads the synced metadata from MongoDB on each request (never prerendered).
export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const docs = await listKnowledgeDocuments();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="מקורות הבוט"
        description="מסמכי הידע המקצועיים שעליהם יתבסס בוט החניכה והמשוב בהמשך."
      />
      <KnowledgeExplorer docs={docs} />
    </div>
  );
}
