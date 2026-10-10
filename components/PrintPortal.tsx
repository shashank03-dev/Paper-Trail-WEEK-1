"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PAPER_MM } from "@/lib/zine/layout";
import type { Paper } from "@/lib/schemas";

/** Mounts printable content directly under <body> with an exact @page size. */
export function PrintPortal({ paper, children }: { paper: Paper; children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.createElement("div");
    el.className = "print-root";
    document.body.appendChild(el);
    setHost(el);
    return () => el.remove();
  }, []);
  const { w, h } = PAPER_MM[paper];
  return host
    ? createPortal(
        <>
          <style>{`@page { size: ${paper === "letter" ? "letter" : "A4"} landscape; margin: 0; } .print-root svg { width: ${w}mm; height: ${h}mm; }`}</style>
          {children}
        </>,
        host,
      )
    : null;
}
