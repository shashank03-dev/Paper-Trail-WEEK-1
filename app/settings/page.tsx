"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getConfig, type PublicConfig } from "@/lib/client/api";
import { llmHeaders, loadSettings, saveSettings, type ClientSettings } from "@/lib/client/settings";
import type { Paper } from "@/lib/schemas";

export default function Settings() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [s, setS] = useState<ClientSettings>({});
  const [test, setTest] = useState<{ state: "idle" | "busy" | "ok" | "fail"; text: string }>({
    state: "idle",
    text: "",
  });
  useEffect(() => {
    setS(loadSettings());
    void getConfig().then(setCfg);
  }, []);
  const set = (patch: Partial<ClientSettings>) => {
    const n = { ...s, ...patch };
    for (const k of Object.keys(n) as (keyof ClientSettings)[]) if (n[k] === "") delete n[k];
    setS(n);
    saveSettings(n);
  };
  const run = async () => {
    setTest({ state: "busy", text: "Pinging the model…" });
    try {
      const r = await fetch("/api/health", { headers: llmHeaders() });
      const j = (await r.json()) as {
        ok: boolean;
        model: string;
        latencyMs: number;
        tokensPerSec: number | null;
        where: string;
        error?: string;
        mode: string;
      };
      setTest(
        j.ok
          ? {
              state: "ok",
              text: `${j.model} answered in ${j.latencyMs} ms${j.tokensPerSec ? ` · ${j.tokensPerSec} tok/s` : ""} · ${j.where}`,
            }
          : {
              state: "fail",
              text: `No answer from ${j.model} (${j.error ?? j.mode}). Is Ollama running? Try: ollama serve && ollama pull ${j.model}`,
            },
      );
    } catch (e) {
      setTest({ state: "fail", text: (e as Error).message });
    }
  };
  return (
    <div className="mx-auto max-w-3xl px-[var(--gutter)] pb-16 pt-32 sm:pt-40">
      <p className="label folio">Saved in this browser</p>
      <h1 className="display mt-6 text-[clamp(3rem,1.6rem+5vw,6rem)]">Settings</h1>
      <section className="card mt-10 grid gap-6 p-6 sm:p-8" aria-labelledby="model-h">
        <h2 id="model-h" className="title text-[2rem]">
          The model
        </h2>
        <div>
          <label htmlFor="ep" className="label block">
            Where the model runs
          </label>
          {cfg?.allowEndpointOverride ? (
            <input
              id="ep"
              className="field mono mt-2"
              placeholder={cfg.endpoint || "http://localhost:11434/v1"}
              value={s.endpoint ?? ""}
              onChange={(e) => set({ endpoint: e.target.value })}
            />
          ) : (
            <p
              id="ep"
              className="mono mt-2 rounded-2xl text-ink-2 bg-bone/60 shadow-[inset_0_0_0_1px_var(--color-line-2)] px-4 py-3 text-[0.82rem] leading-relaxed"
            >
              Set on the server: {cfg?.providers?.join(" → ") ?? "…"}. Change it with{" "}
              <code>LLM_PROVIDER</code> and the API keys, or set{" "}
              <code>ALLOW_ENDPOINT_OVERRIDE=true</code> to edit it here.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mt" className="label block">
              Text model (writer)
            </label>
            <input
              id="mt"
              className="field mono mt-2"
              placeholder={cfg?.modelText ?? "gemma4:e4b"}
              value={s.modelText ?? ""}
              onChange={(e) => set({ modelText: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="mv" className="label block">
              Vision model (reader)
            </label>
            <input
              id="mv"
              className="field mono mt-2"
              placeholder={cfg?.modelVision ?? "gemma4:e4b"}
              value={s.modelVision ?? ""}
              onChange={(e) => set({ modelVision: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-ink-3">
          Try <code className="mono">gemma4:e2b</code> on smaller machines. Only open-weights models
          served by your own endpoint are supported.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-ink"
            onClick={run}
            disabled={test.state === "busy"}
            data-testid="test-connection"
          >
            Test connection
          </button>
          <p
            role="status"
            aria-live="polite"
            data-testid="test-result"
            className={`text-sm ${test.state === "ok" ? "text-riso" : test.state === "fail" ? "text-postmark" : "text-ink-3"}`}
          >
            {test.text}
          </p>
        </div>
      </section>
      <section className="card mt-6 grid gap-5 p-6 sm:p-8" aria-labelledby="paper-h">
        <h2 id="paper-h" className="title text-[2rem]">
          Paper
        </h2>
        <div className="flex gap-2" role="radiogroup" aria-label="Paper size">
          {(["letter", "a4"] as Paper[]).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={(s.paper ?? "") === p}
              className="chip"
              onClick={() => set({ paper: p })}
            >
              {p === "letter" ? "US Letter" : "A4"}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={!s.paper}
            className="chip"
            onClick={() => set({ paper: undefined })}
          >
            Auto (from language)
          </button>
        </div>
      </section>
      <p className="mt-8">
        <Link href="/why-open" className="link text-ink-2">
          Why open models? →
        </Link>
      </p>
    </div>
  );
}
