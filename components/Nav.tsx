"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { Logo } from "./Logo";
import { ModelBadge } from "./ModelBadge";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/book", label: "Trail Book" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="no-print fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:pt-4">
      <div className="glass flex w-full max-w-5xl items-center justify-between gap-2 rounded-full py-1.5 pl-4 pr-1.5">
        <Link href="/" aria-label="Paper Trail home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`hidden rounded-full px-3 py-2 text-[0.88rem] transition-colors hover:text-fg sm:block ${path === l.href ? "text-fg" : "text-fg-2"}`}
            >
              {l.label}
            </Link>
          ))}
          <span className="mx-2 hidden lg:inline-flex">
            <ModelBadge compact />
          </span>
          <Link
            href="/settings"
            aria-label="Settings"
            className="grid h-9 w-9 place-items-center rounded-full text-fg-2 transition-colors hover:bg-white/5 hover:text-fg"
          >
            <Settings size={17} strokeWidth={1.6} />
          </Link>
          <Link href="/new" className="btn btn-primary btn-sm">
            Make a trail
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="no-print relative mx-auto w-full max-w-6xl px-5 pb-10 pt-24 text-sm text-fg-3 sm:px-8">
      <div className="hairline mb-8" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 leading-relaxed">
            A printed walk for the streets around you. Open source, MIT licensed.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2">
          <Link className="link w-fit hover:text-fg" href="/new">
            Make a trail
          </Link>
          <Link className="link w-fit hover:text-fg" href="/book">
            Trail Book
          </Link>
          <Link className="link w-fit hover:text-fg" href="/why-open">
            Why an open model
          </Link>
          <Link className="link w-fit hover:text-fg" href="/fold-test">
            Fold test
          </Link>
          <a
            className="link w-fit hover:text-fg"
            href="https://github.com/shashank03-dev/Paper-Trail-WEEK-1"
          >
            Source code
          </a>
          <Link className="link w-fit hover:text-fg" href="/settings">
            Settings
          </Link>
        </div>
      </div>
      <p className="mono mt-10 text-[0.7rem] leading-relaxed">
        Map data ©{" "}
        <a className="link" href="https://www.openstreetmap.org/copyright">
          OpenStreetMap contributors
        </a>{" "}
        · Weather by Open-Meteo · No accounts, no tracking. Your trails live in this browser.
      </p>
    </footer>
  );
}
