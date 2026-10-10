"use client";
import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { LostSheet } from "@/components/LostSheet";
import { reportError } from "@/lib/client/report";

/** A page broke while rendering. Say so plainly, report it, offer a way on. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => reportError("render", error, error.digest), [error]);
  return (
    <div className="mx-auto grid min-h-[80svh] max-w-6xl items-center gap-12 px-[var(--gutter)] pb-16 pt-32 md:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="label folio">Something tore</p>
        <h1 className="display mt-6 text-[clamp(3rem,1.6rem+5vw,6rem)]">
          This page ripped <em className="text-riso">mid-fold.</em>
        </h1>
        <p className="lede mt-6 max-w-md">
          We&rsquo;ve noted it on our side. Your trails are safe: they live in this browser, not on
          this page. Try again, and if it keeps happening, let us know.
        </p>
        {error.digest && (
          <p className="mono mt-4 text-[0.78rem] text-ink-3">Reference: {error.digest}</p>
        )}
        <div className="mt-9 flex flex-wrap gap-3">
          <button type="button" className="btn btn-ink btn-lg" onClick={reset}>
            <RotateCcw size={17} /> Try again
          </button>
          <Link href="/" className="btn btn-sheet btn-lg">
            Back to the start
          </Link>
          <a
            href="https://github.com/shashank03-dev/Paper-Trail-WEEK-1/issues/new"
            className="btn btn-lg"
          >
            Report it
          </a>
        </div>
      </div>
      <LostSheet className="mx-auto w-full max-w-md" />
    </div>
  );
}
