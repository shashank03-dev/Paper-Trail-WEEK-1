"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Booklet } from "@/components/Booklet";
import { FoldGuide } from "@/components/FoldGuide";
import { GoOverlay } from "@/components/GoOverlay";
import { Icon3D } from "@/components/Icon3D";
import { PrintPortal } from "@/components/PrintPortal";
import { SheetStage } from "@/components/SheetStage";
import { Sheet } from "@/lib/zine/Sheet";
import type { PageNo } from "@/lib/zine/layout";
import { db, type TrailRecord } from "@/lib/client/db";
import { getConfig, postJSON, postSSE, type PublicConfig } from "@/lib/client/api";
import { contextFromTrail, zineData } from "@/lib/client/trail";
import { useScreenTime } from "@/lib/client/useScreenTime";
import { downloadSheetPdf } from "@/lib/client/pdf";
import { saveSettings, loadSettings } from "@/lib/client/settings";
import type { CopyPanel, GenPath, Panels, Paper, RegenPanel, TrailPlan } from "@/lib/schemas";

const COPY_ORDER: { panel: CopyPanel; page: PageNo }[] = [
  { panel: "cover", page: 1 },
  { panel: "route", page: 3 },
  { panel: "listen", page: 5 },
  { panel: "back", page: 8 },
];
const PAGE_TO_PANEL: Partial<Record<PageNo, RegenPanel>> = {
  1: "cover",
  3: "route",
  4: "ispy",
  5: "listen",
  6: "riddle",
  7: "sketch",
  8: "back",
};

function pendingPages(t: TrailRecord): PageNo[] {
  const p: PageNo[] = [];
  if (!t.plan) p.push(4, 6, 7);
  for (const { panel, page } of COPY_ORDER) if (!t.plan || !t.panels[panel]) p.push(page);
  return p;
}

export default function TrailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const trail = useLiveQuery(() => db().trails.get(id), [id]);
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [meta, setMeta] = useState<{
    tps: number | null;
    where: string;
    mode: string;
    status: string;
  }>({ tps: null, where: "local", mode: "live", status: "" });
  const [view, setView] = useState<"flat" | "folded">("flat");
  const [rerolling, setRerolling] = useState<PageNo | null>(null);
  const [go, setGo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const running = useRef(false);
  useScreenTime(trail ? id : null, "preview");

  useEffect(() => {
    void getConfig().then(setCfg);
  }, []);

  const save = useCallback((patch: Partial<TrailRecord>) => db().trails.update(id, patch), [id]);
  const setPath = useCallback(
    async (k: string, p: GenPath) => {
      const t = await db().trails.get(id);
      if (t) await db().trails.update(id, { genPaths: { ...t.genPaths, [k]: p } });
    },
    [id],
  );

  // The printing press: plan first (streamed), then each panel's copy.
  useEffect(() => {
    if (!trail || running.current || pendingPages(trail).length === 0) return;
    running.current = true;
    const ctx = contextFromTrail(trail);
    (async () => {
      try {
        let plan = trail.plan;
        let planPath: GenPath = "llm";
        if (!plan) {
          setMeta((m) => ({ ...m, status: "Gemma is planning your trail…" }));
          await postSSE("/api/trail/plan", { context: ctx }, (e) => {
            if (e.type === "status")
              setMeta((m) => ({ ...m, where: String(e.where), mode: String(e.mode) }));
            if (e.type === "tokens") setMeta((m) => ({ ...m, tps: Number(e.tps) }));
            if (e.type === "plan") {
              plan = e.plan as TrailPlan;
              planPath = e.path as GenPath;
              if (e.tps) setMeta((m) => ({ ...m, tps: Number(e.tps) }));
            }
            if (e.type === "error") throw new Error(String(e.error));
          });
          if (!plan) throw new Error("The writer didn't return a plan.");
          await save({ plan });
          await setPath("plan", planPath);
        }
        for (const { panel } of COPY_ORDER) {
          const cur = await db().trails.get(id);
          if (cur?.panels[panel]) continue;
          setMeta((m) => ({
            ...m,
            status: `Writing the ${panel === "back" ? "back cover" : panel}…`,
          }));
          const r = await postJSON<{
            copy: Panels[CopyPanel];
            path: GenPath;
            tokens: number;
            ms: number;
          }>("/api/trail/panel", { trailId: id, panel, plan, context: ctx });
          const latest = await db().trails.get(id);
          await save({ panels: { ...latest!.panels, [panel]: r.copy } });
          await setPath(panel, r.path);
          if (r.ms > 0 && r.tokens)
            setMeta((m) => ({ ...m, tps: Math.round((r.tokens / (r.ms / 1000)) * 10) / 10 }));
        }
        setMeta((m) => ({ ...m, status: "" }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        running.current = false;
      }
    })();
  }, [trail, id, save, setPath]);

  const reroll = async (page: PageNo) => {
    const panel = PAGE_TO_PANEL[page];
    if (!trail?.plan || !panel) return;
    setRerolling(page);
    setError(null);
    try {
      const r = await postJSON<{ copy?: Panels[CopyPanel]; plan?: TrailPlan; path: GenPath }>(
        "/api/trail/panel",
        { trailId: id, panel, plan: trail.plan, context: contextFromTrail(trail) },
      );
      if (r.plan) await save({ plan: r.plan });
      if (r.copy) await save({ panels: { ...trail.panels, [panel]: r.copy } });
      await setPath(panel, r.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRerolling(null);
    }
  };

  const print = async () => {
    if (!trail) return;
    if (!trail.printedAt) await save({ printedAt: Date.now() });
    const after = () => {
      window.removeEventListener("afterprint", after);
      setGo(true);
    };
    window.addEventListener("afterprint", after);
    window.print();
    // Some browsers never fire afterprint; show the card anyway.
    window.setTimeout(after, 1500);
  };

  const pdf = async () => {
    const svg = document.getElementById(`sheet-${id}`) as unknown as SVGSVGElement | null;
    if (!svg) return;
    setPdfBusy(true);
    try {
      await downloadSheetPdf(svg, `paper-trail-${id}.pdf`);
    } catch (e) {
      setError(`PDF export failed (${(e as Error).message}). Use Print → Save as PDF instead.`);
    } finally {
      setPdfBusy(false);
    }
  };

  if (trail === undefined)
    return <p className="mx-auto max-w-5xl px-6 py-20 text-muted">Unfolding…</p>;
  if (trail === null)
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <Icon3D name="magnifier" size={80} className="mx-auto" />
        <h1 className="display mt-4 text-3xl">No trail here.</h1>
        <p className="mt-2 text-muted">Trails live in the browser that made them.</p>
        <Link href="/new" className="btn btn-primary mt-6">
          Make a new one
        </Link>
      </div>
    );

  const pending = pendingPages(trail);
  const done = pending.length === 0;
  const data = zineData(trail, cfg);
  const paths = Object.values(trail.genPaths);
  const replay = paths.includes("replay") || meta.mode === "replay";
  const fallback = paths.includes("fallback");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-2 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">
            No. {String(trail.edition).padStart(3, "0")} · {trail.location.label} ·{" "}
            {trail.durationMin} min
          </p>
          <h1 className="display riso mt-1 text-3xl sm:text-5xl">
            {trail.plan?.title ?? "Printing your trail…"}
          </h1>
          {trail.plan && (
            <p className="display mt-2 text-lg italic text-ink/70">{trail.plan.subtitle}</p>
          )}
        </div>
        <p className="mono text-xs text-muted" aria-live="polite" data-testid="gen-meta">
          {trail.model} · {meta.where}
          {meta.tps ? ` · ${meta.tps} tok/s` : ""}
          {replay && <span className="ml-2 rounded bg-sun px-1.5 py-0.5 text-ink">replay</span>}
          {fallback && (
            <span
              className="ml-2 rounded bg-desk px-1.5 py-0.5 text-ink"
              title="Some panels used the deterministic template because the model was unavailable or kept failing validation."
            >
              template
            </span>
          )}
        </p>
      </div>

      {!done && (
        <div
          className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink/30 bg-card/60 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <Icon3D name="printer" size={36} className="animate-bounce" />
          <span className="text-sm">
            {meta.status || "Warming up the press…"}{" "}
            <span className="mono text-xs text-muted">({8 - pending.length}/8 pages)</span>
          </span>
        </div>
      )}
      {error && (
        <p
          className="mt-4 rounded-xl border-2 border-pink bg-[#ffe9ef] px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}

      <div
        className="no-print mt-6 flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="Sheet options"
      >
        <div className="flex gap-1" role="radiogroup" aria-label="View">
          <button
            type="button"
            role="radio"
            aria-checked={view === "flat"}
            className="chip"
            onClick={() => setView("flat")}
          >
            Flat sheet
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === "folded"}
            className="chip"
            onClick={() => setView("folded")}
            disabled={!done}
          >
            Folded booklet
          </button>
        </div>
        <button
          type="button"
          className="chip"
          aria-pressed={trail.color}
          onClick={() => save({ color: !trail.color })}
        >
          <Icon3D name="palette" size={22} /> {trail.color ? "Colour" : "B&W"}
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => {
            const paper: Paper = trail.paper === "letter" ? "a4" : "letter";
            void save({ paper });
            saveSettings({ ...loadSettings(), paper });
          }}
          aria-label={`Paper size: ${trail.paper === "letter" ? "US Letter" : "A4"}. Switch.`}
        >
          {trail.paper === "letter" ? "US Letter" : "A4"}
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={pdf} disabled={!done || pdfBusy}>
            {pdfBusy ? "Making PDF…" : "Download PDF"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={print}
            disabled={!done}
            data-testid="print"
          >
            <Icon3D name="printer" size={22} /> Print
          </button>
        </div>
      </div>

      <div className="mt-6" data-testid="sheet-preview">
        {view === "flat" || !done ? (
          <SheetStage
            data={data}
            pending={pending}
            onReroll={done ? reroll : undefined}
            rerolling={rerolling}
            svgId={`sheet-${id}`}
          />
        ) : (
          <>
            <Booklet data={data} />
            {/* Keep the full sheet in the DOM for PDF export. */}
            <div className="hidden">
              <Sheet data={data} id={`sheet-${id}`} />
            </div>
          </>
        )}
      </div>
      {done && view === "flat" && (
        <p className="no-print mt-3 text-center text-xs text-muted">
          Hover a panel to re-roll it. The preview is the print, 1:1.{" "}
          {trail.paper === "letter" ? "Letter" : "A4"}, landscape, no margins, “actual size”.
        </p>
      )}

      {done && (
        <section className="no-print mt-12" aria-labelledby="fold-guide">
          <h2 id="fold-guide" className="display flex items-center gap-2 text-2xl">
            <Icon3D name="scissors" size={34} /> One cut, six folds
          </h2>
          <div className="mt-4">
            <FoldGuide />
          </div>
          <p className="mt-4 text-sm text-muted">
            Not sure the pages land in order? Print the{" "}
            <Link className="underline" href="/fold-test">
              fold test
            </Link>{" "}
            first.
          </p>
        </section>
      )}

      {done && (
        <PrintPortal paper={trail.paper}>
          <Sheet data={data} paperBg={false} />
        </PrintPortal>
      )}
      {go && <GoOverlay trailId={id} onClose={() => setGo(false)} />}
    </div>
  );
}
