"use client";
import { useEffect, useState } from "react";
import { llmHeaders } from "@/lib/client/settings";

interface Health {
  ok: boolean;
  model: string;
  where: string;
  latencyMs: number;
  tokensPerSec: number | null;
  mode: "live" | "replay" | "down";
}

let cached: Promise<Health> | null = null;
function health(): Promise<Health> {
  if (!cached)
    cached = fetch("/api/health", { headers: llmHeaders() })
      .then((r) => r.json() as Promise<Health>)
      .catch(() => ({
        ok: false,
        model: "gemma4",
        where: "local",
        latencyMs: 0,
        tokensPerSec: null,
        mode: "down" as const,
      }));
  return cached;
}

/** Live model status: "Gemma 4 · gemma4:e4b · on your machine". */
export function ModelBadge({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    void health().then((x) => alive && setH(x));
    return () => {
      alive = false;
    };
  }, []);
  const color = !h
    ? "bg-ink-3"
    : h.ok
      ? "bg-moss"
      : h.mode === "replay"
        ? "bg-amber"
        : "bg-postmark";
  const where = !h
    ? "checking…"
    : h.ok
      ? h.where === "local"
        ? "on your machine"
        : `via ${h.where}`
      : h.mode === "replay"
        ? "replay mode"
        : "model offline";
  return (
    <span
      className={`mono inline-flex items-center gap-2 text-[0.74rem] text-ink-2 ${className}`}
      role="status"
      aria-live="polite"
      title={
        h?.ok
          ? `${h.model} · ${h.latencyMs} ms${h.tokensPerSec ? ` · ${h.tokensPerSec} tok/s` : ""}`
          : undefined
      }
    >
      <span className={`dot-live ${color}`}>
        {h?.ok && (
          <span className={`absolute inset-0 animate-ping rounded-full ${color} opacity-50`} />
        )}
      </span>
      {compact ? (
        <span>{h?.model ?? "gemma4"}</span>
      ) : (
        <span>
          Runs on Gemma 4 · <span className="text-ink-3">{h?.model ?? "…"}</span> · {where}
        </span>
      )}
    </span>
  );
}
