"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

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
    <motion.div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="go-title"
      className="no-print fixed inset-0 z-[150] grid place-items-center bg-bg/95 p-6 outline-none backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="max-w-2xl text-center">
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          Printed
        </motion.p>
        <motion.h2
          id="go-title"
          className="display mt-6 text-[clamp(3rem,2rem+5vw,6.5rem)]"
          initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.4, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Put your phone down. <em className="text-grass">Go.</em>
        </motion.h2>
        <motion.p
          className="lede mx-auto mt-6 max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
        >
          Nothing is counting on this screen. That&rsquo;s the point. When you&rsquo;re back, open
          this trail and take one photo of the sheet.
        </motion.p>
        <motion.div
          className="mt-12 flex flex-wrap justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 1 }}
        >
          <Link href={`/return/${trailId}`} className="btn btn-primary btn-lg">
            I&rsquo;m back <ArrowRight size={18} className="arrow" />
          </Link>
          <button type="button" className="btn btn-lg" onClick={onClose}>
            Show the sheet again
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
