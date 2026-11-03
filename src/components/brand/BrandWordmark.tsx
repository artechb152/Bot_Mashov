import { cn } from "@/lib/cn";

/**
 * The single, shared brand wordmark — **חונך+**.
 *
 * The word "חונך" carries the brand colour and the "+" is the action blue, set a
 * touch smaller and raised slightly (never oversized — it must not outweigh the
 * word). No image, gradient, shadow, border, or bot icon. RTL-correct: the plus
 * renders to the inline-end (left) of the word; screen readers announce a single
 * accessible name, "חונך פלוס".
 *
 * Use this everywhere the product name appears visually — do not hand-duplicate the
 * text. Pick `tone` by background (onDark = light word for dark fields; onLight =
 * navy word for light fields) and `size` by context.
 */
type BrandSize = "sm" | "md" | "lg" | "xl";
type BrandTone = "onDark" | "onLight";

const SIZES: Record<BrandSize, { word: string; plus: string; weight: string }> = {
  sm: { word: "text-xl", plus: "text-lg", weight: "font-bold" }, // sidebar / top-bar brand
  md: { word: "text-3xl", plus: "text-2xl", weight: "font-bold" }, // compact headers
  lg: { word: "text-4xl sm:text-5xl", plus: "text-3xl sm:text-4xl", weight: "font-extrabold" }, // auth brand
  xl: { word: "text-6xl sm:text-7xl", plus: "text-5xl sm:text-6xl", weight: "font-extrabold" }, // hero
};

export function BrandWordmark({
  size = "md",
  tone = "onDark",
  className,
}: {
  size?: BrandSize;
  tone?: BrandTone;
  className?: string;
}) {
  const s = SIZES[size];
  const wordColor = tone === "onDark" ? "text-white" : "text-brand-primary";
  return (
    <span
      dir="rtl"
      role="img"
      aria-label="חונך פלוס"
      className={cn("inline-flex select-none items-baseline whitespace-nowrap leading-none tracking-tight", s.weight, className)}
    >
      <span aria-hidden="true" className={cn(s.word, wordColor)}>
        חונך
      </span>
      {/* Slightly smaller and raised; the accent blue makes it "present" without dominating. */}
      <span aria-hidden="true" className={cn(s.plus, "ms-[0.04em] -translate-y-[0.06em] text-brand-action")}>
        +
      </span>
    </span>
  );
}
