import { redirect } from "next/navigation";

/**
 * Individual knowledge documents are not user-facing either — see the note in
 * `../page.tsx`. Redirects instead of rendering; nothing was deleted, and the
 * renderer (`components/knowledge/KnowledgeMarkdown.tsx`) plus the data layer
 * remain available for the future bot.
 */
export default function KnowledgeDocPage() {
  redirect("/assistant");
}
