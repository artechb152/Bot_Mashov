/**
 * Single source of truth for the product's identity (plain text — for the document
 * title, metadata, and any place that needs a string). The *visual* brand mark is
 * the shared `BrandWordmark` component; this is only the textual name.
 */
export const siteConfig = {
  /** Short brand mark (plain text) used in the title template. */
  name: "חונך+",
  /** Full title used as the default document title. */
  fullName: "חונך+ | מערכת חניכה ומשוב",
  /** One-line description used in metadata. */
  description:
    "כלי חכם לחניכה, משוב, סיכום ומעקב אחר התקדמות החניכים.",
} as const;
