"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { Logo } from "./Logo";
import { ModelBadge } from "./ModelBadge";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#pages", label: "Inside" },
  { href: "/book", label: "Trail Book" },
  { href: "/why-open", label: "Why open" },
];

export function Nav() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Over a dark band (the darkroom, the footer) the bar turns to smoked glass.
    const on = () => {
      setScrolled(window.scrollY > 12);
      const under = document.elementsFromPoint(window.innerWidth / 2, 36);
      setDark(under.some((el) => el.closest("[data-surface='dark']")));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // Close the folded menu on navigation and with Escape.
  useEffect(() => {
    setOpen(false);
    window.dispatchEvent(new Event("scroll"));
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`no-print fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 ${dark && !open ? "nav-dark" : ""}`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-full py-1.5 pl-3 pr-1.5 transition-[background,box-shadow,backdrop-filter] duration-500 sm:pl-4 ${scrolled || open ? "glass" : ""}`}
      >
        <Link href="/" aria-label="Paper Trail, home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-[0.9rem] transition-colors hover:bg-ink/5 hover:text-ink ${path === l.href ? "text-ink" : "text-ink-2"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <span className="mr-2 hidden xl:inline-flex">
            <ModelBadge compact />
          </span>
          <Link
            href="/settings"
            aria-label="Settings"
            className="hidden h-10 w-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink sm:grid"
          >
            <Settings2 size={18} strokeWidth={1.6} />
          </Link>
          <Link href="/new" className="btn btn-ink btn-sm">
            Make a trail
          </Link>
          <button
            ref={toggle}
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5 md:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="relative block h-3 w-5" aria-hidden>
              <span
                className={`absolute left-0 top-0 h-[1.5px] w-5 bg-current transition-transform duration-500 ease-[var(--ease-out-expo)] ${open ? "translate-y-[5.25px] rotate-45" : ""}`}
              />
              <span
                className={`absolute bottom-0 left-0 h-[1.5px] w-5 bg-current transition-transform duration-500 ease-[var(--ease-out-expo)] ${open ? "-translate-y-[5.25px] -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </div>
      <FoldMenu id={menuId} open={open} path={path} />
    </header>
  );
}

/**
 * The phone menu unfolds like the zine does: three panels hinged at their top
 * edges swing down one after another.
 */
function FoldMenu({ id, open, path }: { id: string; open: boolean; path: string }) {
  const facets = [
    LINKS.slice(0, 2),
    LINKS.slice(2),
    [
      { href: "/settings", label: "Settings" },
      { href: "/fold-test", label: "Fold test" },
    ],
  ];
  return (
    <div id={id} className="mx-auto mt-2 max-w-7xl [perspective:1400px] md:hidden" hidden={!open}>
      <nav aria-label="Menu" className="[transform-style:preserve-3d]">
        {facets.map((group, i) => (
          <div
            key={i}
            className="glass origin-top overflow-hidden px-6 py-4 first:rounded-t-[22px] last:rounded-b-[22px]"
            style={{ animation: `unfold 760ms var(--ease-paper) ${i * 110}ms both` }}
          >
            <p className="label mb-1">{["Read", "Yours", "Tools"][i]}</p>
            <ul>
              {group.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={path === l.href ? "page" : undefined}
                    className="flex items-center justify-between py-2 font-serif text-[1.9rem] leading-tight tracking-[-0.015em]"
                  >
                    {l.label}
                    <ArrowUpRight size={20} strokeWidth={1.4} className="text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer
      data-surface="dark"
      className="no-print relative mt-24 overflow-hidden bg-ink text-dark-fg"
    >
      <div className="mx-auto max-w-7xl px-[var(--gutter)] pt-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <p className="label !text-dark-fg-2">Colophon</p>
            <p className="mt-4 font-serif text-[1.7rem] leading-[1.15] tracking-[-0.01em]">
              A walk you print at home, written by an open model and read back from one photo.
            </p>
            <p className="mt-5 text-[0.92rem] leading-relaxed text-dark-fg-2">
              No accounts, no tracking. Your trails are kept in this browser and nowhere else.
            </p>
          </div>
          <FooterList
            title="Make"
            links={[
              { href: "/new", label: "Make a trail" },
              { href: "/book", label: "Trail Book" },
              { href: "/fold-test", label: "Fold test" },
              { href: "/settings", label: "Settings" },
            ]}
          />
          <FooterList
            title="Read"
            links={[
              { href: "/#how", label: "How it works" },
              { href: "/why-open", label: "Why an open model" },
              {
                href: "https://github.com/shashank03-dev/Paper-Trail-WEEK-1",
                label: "Source code",
              },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              {
                href: "https://github.com/shashank03-dev/Paper-Trail-WEEK-1/issues",
                label: "Report a problem",
              },
            ]}
          />
        </div>
        <p className="mono mt-16 text-[0.72rem] leading-relaxed text-dark-fg-2">
          Map data ©{" "}
          <a className="underline-ink" href="https://www.openstreetmap.org/copyright">
            OpenStreetMap contributors
          </a>{" "}
          · Weather by Open-Meteo · Words by Gemma · MIT licensed
        </p>
      </div>
      {/* The masthead, set huge and faint as the last thing on every page. */}
      <svg
        aria-hidden
        viewBox="0 0 1000 190"
        className="pointer-events-none mt-10 block w-full select-none"
      >
        <text
          x="500"
          y="170"
          textAnchor="middle"
          fontFamily="Instrument Serif, Georgia, serif"
          fontSize="232"
          letterSpacing="-10"
          fill="rgb(238 233 223 / 0.08)"
        >
          Paper <tspan fontStyle="italic">Trail</tspan>
        </text>
      </svg>
    </footer>
  );
}

function FooterList({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="label !text-dark-fg-2">{title}</p>
      <ul className="mt-4 grid gap-2.5">
        {links.map((l) => (
          <li key={l.href}>
            {l.href.startsWith("http") ? (
              <a className="link text-[1rem] hover:text-white" href={l.href}>
                {l.label}
              </a>
            ) : (
              <Link className="link text-[1rem] hover:text-white" href={l.href}>
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
