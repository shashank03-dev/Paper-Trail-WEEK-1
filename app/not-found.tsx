import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LostSheet } from "@/components/LostSheet";

export const metadata = { title: "Off the map" };

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[80svh] max-w-6xl items-center gap-12 px-[var(--gutter)] pb-16 pt-32 md:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="label folio">404 · Off the map</p>
        <h1 className="display mt-6 text-[clamp(3rem,1.6rem+5vw,6rem)]">
          This page <em className="text-riso">wandered off.</em>
        </h1>
        <p className="lede mt-6 max-w-md">
          The path you followed isn&rsquo;t on any sheet we printed. It happens on the best walks.
          Trails live in the browser that made them, so a trail link from another device won&rsquo;t
          open here either.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-ink btn-lg">
            Back to the start
          </Link>
          <Link href="/new" className="btn btn-riso btn-lg">
            Make a trail
            <span className="knob" aria-hidden>
              <ArrowRight size={18} />
            </span>
          </Link>
        </div>
      </div>
      <LostSheet className="mx-auto w-full max-w-md" />
    </div>
  );
}
