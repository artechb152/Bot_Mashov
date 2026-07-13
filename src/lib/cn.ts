/**
 * Join class names, dropping falsy values. Deliberately dependency-free so the
 * hand-rolled UI primitives stay lightweight (no clsx / tailwind-merge).
 * Caller-supplied classes are passed last so they can extend a component's base.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
