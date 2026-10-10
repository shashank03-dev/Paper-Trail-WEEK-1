import Link from "next/link";
import { ModelBadge } from "./ModelBadge";
import { Icon3D } from "./Icon3D";

export function Nav() {
  return (
    <header className="no-print mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Link href="/" className="group flex items-center gap-2" aria-label="Paper Trail home">
        <Icon3D name="footprints" size={34} className="wiggle" />
        <span className="display riso text-xl sm:text-2xl">Paper Trail</span>
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/new"
          className="rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-desk sm:px-3"
        >
          New trail
        </Link>
        <Link
          href="/book"
          className="rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-desk sm:px-3"
        >
          Trail Book
        </Link>
        <Link
          href="/settings"
          className="rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-desk sm:px-3"
          aria-label="Settings"
        >
          <Icon3D name="gear" size={22} />
        </Link>
        <span className="hidden md:inline-flex">
          <ModelBadge compact />
        </span>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="no-print mx-auto mt-24 w-full max-w-6xl px-4 pb-10 text-sm text-muted sm:px-6">
      <div className="flex flex-col gap-2 border-t-2 border-dashed border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Paper Trail · open source · MIT · map data ©{" "}
          <a className="underline" href="https://www.openstreetmap.org/copyright">
            OpenStreetMap contributors
          </a>
        </p>
        <p className="mono text-xs">
          No accounts. No analytics. Your trails live in this browser.{" "}
          <Link href="/why-open" className="underline">
            Why open models?
          </Link>
        </p>
      </div>
    </footer>
  );
}
