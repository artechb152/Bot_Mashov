import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a knowledge document's Markdown body with on-brand, RTL-correct
 * styling (no @tailwindcss/typography needed — each element is mapped to design
 * tokens). Renders on the server; the body string is trusted local content.
 */
const components: Components = {
  h1: ({ node, ...props }) => (
    <h1 className="mt-6 mb-2 text-xl font-semibold text-ink first:mt-0" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mt-6 mb-2 text-lg font-semibold text-ink first:mt-0" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mt-4 mb-1.5 text-base font-semibold text-ink" {...props} />
  ),
  p: ({ node, ...props }) => <p className="my-3 text-ink/90" {...props} />,
  ul: ({ node, ...props }) => (
    <ul className="my-3 list-disc space-y-1 ps-6 marker:text-line-strong" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="my-3 list-decimal space-y-1 ps-6 marker:text-subtle" {...props} />
  ),
  li: ({ node, ...props }) => <li className="text-ink/90" {...props} />,
  a: ({ node, ...props }) => (
    <a className="font-medium text-ink underline underline-offset-2 hover:opacity-80" {...props} />
  ),
  strong: ({ node, ...props }) => <strong className="font-semibold text-ink" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  // Fenced code blocks render as <pre><code>…</code></pre>: style the block and
  // neutralise the inline-pill styling on its direct <code> child.
  pre: ({ node, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg bg-surface-2 p-4 text-xs text-ink [&>code]:rounded-none [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  code: ({ node, ...props }) => (
    <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="my-3 border-s-2 border-line-strong ps-4 text-muted" {...props} />
  ),
  hr: ({ node, ...props }) => <hr className="my-6 border-line" {...props} />,
  table: ({ node, ...props }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-start text-sm" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th className="border border-line bg-surface-2 px-3 py-2 text-start font-semibold text-ink" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border border-line px-3 py-2 text-start text-ink/90" {...props} />
  ),
};

export function KnowledgeMarkdown({ children }: { children: string }) {
  return (
    <div className="select-text text-sm leading-relaxed text-muted">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
