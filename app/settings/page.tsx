"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon3D } from "@/components/Icon3D";
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
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-2 sm:px-6">
      <p className="kicker">Saved in this browser</p>
      <h1 className="display riso mt-1 text-4xl">Settings</h1>
      <section className="card mt-8 grid gap-5 p-6" aria-labelledby="model-h">
        <h2 id="model-h" className="display flex items-center gap-2 text-2xl">
          <Icon3D name="laptop" size={34} /> The model
        </h2>
        <div>
          <label htmlFor="ep" className="kicker block">
            Model endpoint (OpenAI-compatible)
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
              className="mono mt-2 rounded-xl border-2 border-dashed border-line px-3 py-2 text-sm"
            >
              Set on the server ({cfg?.endpointLabel ?? "…"}). Change <code>LLM_BASE_URL</code>, or
              set <code>ALLOW_ENDPOINT_OVERRIDE=true</code> to edit it here.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mt" className="kicker block">
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
            <label htmlFor="mv" className="kicker block">
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
        <p className="text-xs text-muted">
          Try <code className="mono">gemma4:e2b</code> on smaller machines. Only open-weights models
          served by your own endpoint are supported.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-teal"
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
            className={`text-sm ${test.state === "ok" ? "text-teal" : test.state === "fail" ? "text-pink-deep" : "text-muted"}`}
          >
            {test.text}
          </p>
        </div>
      </section>
      <section className="card mt-6 grid gap-4 p-6" aria-labelledby="paper-h">
        <h2 id="paper-h" className="display flex items-center gap-2 text-2xl">
          <Icon3D name="printer" size={34} /> Paper
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
        <Link href="/why-open" className="underline">
          Why open models? →
        </Link>
      </p>
    </div>
  );
}
