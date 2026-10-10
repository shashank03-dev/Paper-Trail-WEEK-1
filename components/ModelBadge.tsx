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

/** "Runs on Gemma 4 · on your machine" with the live model status. */
export function ModelBadge({ compact = false }: { compact?: boolean }) {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/health", { headers: llmHeaders() })
      .then((r) => r.json())
      .then((j: Health) => alive && setH(j))
      .catch(
        () =>
          alive &&
          setH({
            ok: false,
            model: "gemma4:e4b",
            where: "local",
            latencyMs: 0,
            tokensPerSec: null,
            mode: "down",
          }),
      );
    return () => {
      alive = false;
    };
  }, []);
  const dot = !h ? "bg-line" : h.ok ? "bg-teal" : h.mode === "replay" ? "bg-sun" : "bg-pink";
  const status = !h
    ? "checking…"
    : h.ok
      ? h.where === "local"
        ? "on your machine"
        : `on ${h.where}`
      : h.mode === "replay"
        ? "replay (model offline)"
        : "model offline";
  return (
    <span
      className="mono inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-3 py-1.5 text-[0.72rem] leading-none shadow-[0_3px_0_var(--color-ink)]"
      role="status"
      aria-live="polite"
      title={
        h?.ok
          ? `${h.model} · ${h.latencyMs} ms${h.tokensPerSec ? ` · ${h.tokensPerSec} tok/s` : ""}`
          : undefined
      }
    >
      <span className={`relative inline-block h-2.5 w-2.5 rounded-full ${dot}`}>
        {h?.ok && (
          <span className={`absolute inset-0 animate-ping rounded-full ${dot} opacity-60`} />
        )}
      </span>
      {compact ? (
        <span>{h?.model ?? "gemma4"}</span>
      ) : (
        <span>
          Runs on Gemma 4 · <span className="text-muted">{h?.model ?? "gemma4:e4b"}</span> ·{" "}
          {status}
        </span>
      )}
    </span>
  );
}
