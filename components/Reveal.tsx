/**
 * Fades and lifts content in as it scrolls into view, with a CSS scroll-driven
 * animation: no JavaScript, so content is never held back waiting for
 * hydration, and browsers without support simply show it.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const Tag = as;
  return (
    <Tag
      className={`reveal ${className}`}
      style={
        {
          "--reveal-y": `${y}px`,
          // A stagger shifts where in the scroll the item finishes arriving.
          "--reveal-end": `${22 + Math.round(delay * 60)}%`,
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
