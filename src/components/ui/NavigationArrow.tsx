import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Navigation semantics for Hebrew RTL:
 * - back / previous: right
 * - forward / next: left
 *
 * Do not mirror every Lucide icon. Only navigation icons have this contract.
 * Other directional symbols must be judged by the action they represent.
 */
export function NavigationArrow({
  direction,
  className = "h-4 w-4",
}: {
  direction: "back" | "forward";
  className?: string;
}) {
  const Icon = direction === "back" ? ArrowRight : ArrowLeft;
  return <Icon className={className} aria-hidden="true" />;
}
