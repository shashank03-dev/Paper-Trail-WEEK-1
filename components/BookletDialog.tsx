"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { Booklet } from "@/components/Booklet";
import type { ZineData } from "@/lib/zine/primitives";

/** A zine taken off the shelf and opened on the table, in a dialog. */
export function BookletDialog({ data, onClose }: { data: ZineData; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = overflow;
      before?.focus();
    };
  }, [onClose]);
  return createPortal(
    <motion.div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booklet-title"
      className="no-print fixed inset-0 z-[150] overflow-y-auto bg-bone/90 px-4 py-16 outline-none backdrop-blur-xl sm:px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        type="button"
        onClick={onClose}
        className="btn btn-sheet btn-icon fixed right-4 top-4 z-10 sm:right-6 sm:top-6"
        aria-label="Close the booklet"
      >
        <X size={18} />
      </button>
      <motion.div
        className="mx-auto max-w-3xl"
        initial={{ opacity: 0, y: 40, rotateX: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformPerspective: 1600 }}
      >
        <p className="label text-center">
          No. {String(data.edition).padStart(3, "0")} · {data.locationLabel}
        </p>
        <h2
          id="booklet-title"
          className="headline mt-3 text-center text-[clamp(2rem,1.4rem+2.4vw,3.2rem)]"
        >
          {data.plan?.title}
        </h2>
        <div className="mt-10">
          <Booklet data={data} />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
