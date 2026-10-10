/** Shared layout for the privacy policy and the terms: a readable column on paper. */
export function LegalPage({
  label,
  title,
  updated,
  children,
}: {
  label: string;
  title: React.ReactNode;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-[var(--gutter)] pb-16 pt-32 sm:pt-40">
      <p className="label folio">{label}</p>
      <h1 className="display mt-6 text-[clamp(3rem,1.6rem+5vw,5.6rem)]">{title}</h1>
      <p className="mono mt-6 text-[0.78rem] text-ink-3">Last updated {updated}</p>
      <div className="legal mt-12">{children}</div>
    </div>
  );
}
