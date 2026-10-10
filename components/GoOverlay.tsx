"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon3D } from "./Icon3D";

/** Full-screen "Put your phone down. Go." card shown after printing. */
export function GoOverlay({ trailId, onClose }: { trailId: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="go-title"
      className="no-print fixed inset-0 z-50 grid place-items-center bg-ink p-6 text-paper outline-none"
    >
      <div className="pop-in max-w-xl text-center">
        <Icon3D name="phone-off" size={120} float tilt={-8} className="mx-auto" />
        <h2 id="go-title" className="display mt-6 text-5xl sm:text-7xl">
          Put your phone down. <span className="text-rose">Go.</span>
        </h2>
        <p className="mt-6 text-lg text-paper/75">
          We&rsquo;ll count when you&rsquo;re back. (Nothing is ticking on this screen. That&rsquo;s
          the point.)
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href={`/return/${trailId}`} className="btn btn-primary btn-xl">
            <Icon3D name="house" size={28} /> I&rsquo;m back
          </Link>
          <button type="button" className="btn" onClick={onClose}>
            Not yet, show the sheet
          </button>
        </div>
      </div>
    </div>
  );
}
