"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Booklet } from "@/components/Booklet";
import { FoldGuide } from "@/components/FoldGuide";
import { GoOverlay } from "@/components/GoOverlay";
import { ArrowUpRight, Download, Loader2, Printer, ScanSearch } from "lucide-react";
import { PrintPortal } from "@/components/PrintPortal";
import { SheetStage } from "@/components/SheetStage";
import { Sheet } from "@/lib/zine/Sheet";
import type { PageNo } from "@/lib/zine/layout";
import { db, type TrailRecord } from "@/lib/client/db";
import { getConfig, postJSON, postSSE, type PublicConfig } from "@/lib/client/api";
import { contextFromTrail, zineData } from "@/lib/client/trail";
import { useScreenTime } from "@/lib/client/useScreenTime";
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
  // `get` resolves to undefined for a missing id, which useLiveQuery can't tell
  // apart from "still loading" — map it to null so "No trail here." can show.
  const trail = useLiveQuery(
    () =>
      db()
        .trails.get(id)
        .then((t) => t ?? null),
    [id],
  );
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
      const { downloadSheetPdf } = await import("@/lib/client/pdf");
      await downloadSheetPdf(svg, `paper-trail-${id}.pdf`);
    } catch (e) {
      setError(`PDF export failed (${(e as Error).message}). Use Print → Save as PDF instead.`);
    } finally {
      setPdfBusy(false);
    }
  };

  if (trail === undefined)
    return <p className="mx-auto max-w-5xl px-6 pb-20 pt-40 text-ink-3">Unfolding…</p>;
  if (trail === null)
    return (
      <div className="mx-auto max-w-xl px-6 pb-20 pt-44 text-center">
        <ScanSearch size={36} strokeWidth={1.3} className="mx-auto text-ink-3" />
        <h1 className="headline mt-6 text-5xl">No trail here.</h1>
        <p className="lede mt-4">Trails are kept in the browser that made them.</p>
        <Link href="/new" className="btn btn-ink mt-8">
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
  const paperName = trail.paper === "letter" ? "US Letter" : "A4";

  return (
    <div className="mx-auto max-w-7xl px-[var(--gutter)] pb-16 pt-32 sm:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-4xl">
          <p className="label folio">
            No. {String(trail.edition).padStart(3, "0")} · {trail.location.label} ·{" "}
            {trail.durationMin} min
          </p>
          <h1 className="display mt-6 text-[clamp(2.8rem,1.4rem+4.6vw,5.6rem)]">
            {trail.plan?.title ?? <span className="text-ink-3">Writing your trail…</span>}
          </h1>
          {trail.plan && (
            <p className="mt-4 font-serif text-[clamp(1.3rem,1.1rem+0.6vw,1.7rem)] italic text-ink-2">
              {trail.plan.subtitle}
            </p>
          )}
        </div>
        <p
          className="mono flex flex-wrap items-center gap-2 text-[0.74rem] text-ink-3"
          aria-live="polite"
          data-testid="gen-meta"
        >
          <span className="rounded-full bg-sheet px-3 py-1.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
            {trail.model} · {meta.where}
            {meta.tps ? ` · ${meta.tps} tok/s` : ""}
          </span>
          {replay && (
            <span className="rounded-full bg-[#f4e8cf] px-3 py-1.5 text-amber">replay</span>
          )}
          {fallback && (
            <span
              className="rounded-full bg-bone-2 px-3 py-1.5 text-ink-2"
              title="Some pages used the built-in template because the model was unavailable or kept failing checks."
            >
              template
            </span>
          )}
        </p>
      </div>

      {!done && <PrintQueue pending={pending} status={meta.status || "Warming up the press…"} />}
      {error && (
        <p className="notice notice-error mt-5" role="alert">
          {error}
        </p>
      )}

      <div
        className="no-print mt-10 flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="Sheet options"
      >
        <div className="segmented" role="radiogroup" aria-label="View">
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
          <span
            aria-hidden
            className={`h-3 w-3 rounded-full ${trail.color ? "bg-[conic-gradient(#FF5C8A_0_50%,#1F8A8A_0)]" : "bg-ink-3"}`}
          />
          {trail.color ? "Colour" : "Black & white"}
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => {
            const paper: Paper = trail.paper === "letter" ? "a4" : "letter";
            void save({ paper });
            saveSettings({ ...loadSettings(), paper });
          }}
          aria-label={`Paper size: ${paperName}. Switch.`}
        >
          {paperName}
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn btn-sheet" onClick={pdf} disabled={!done || pdfBusy}>
            {pdfBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} strokeWidth={1.6} />
            )}{" "}
            {pdfBusy ? "Making PDF…" : "PDF"}
          </button>
          <button
            type="button"
            className="btn btn-riso"
            onClick={print}
            disabled={!done}
            data-testid="print"
          >
            <Printer size={17} strokeWidth={1.7} /> Print
          </button>
        </div>
      </div>

      <div
        className="relative mt-6 rounded-[28px] bg-bone-2/60 p-3 shadow-[inset_0_0_0_1px_var(--color-line),inset_0_2px_10px_rgb(21_20_18/0.04)] sm:p-8 lg:p-12"
        data-testid="sheet-preview"
      >
        {view === "flat" || !done ? (
          // Never taller than the window, so the whole sheet is in view at once.
          <div className="mx-auto max-w-[calc((100svh-10rem)*1.3)]">
            <SheetStage
              data={data}
              pending={pending}
              onReroll={done ? reroll : undefined}
              rerolling={rerolling}
              svgId={`sheet-${id}`}
            />
          </div>
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
        <p className="no-print mt-4 text-center text-[0.82rem] text-ink-3">
          Hover a page to rewrite just that page. Print at actual size: {paperName}, landscape, no
          margins.
        </p>
      )}

      {done && (
        <section className="no-print mt-28" aria-labelledby="fold-guide">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label folio">After printing</p>
              <h2
                id="fold-guide"
                className="headline mt-6 text-[clamp(2.4rem,1.6rem+2.6vw,3.8rem)]"
              >
                One cut, <em className="serif-em text-riso">six folds.</em>
              </h2>
            </div>
            <p className="max-w-xs text-[0.92rem] text-ink-2">
              Not sure the pages will land in order? Print the{" "}
              <Link className="underline-ink inline-flex items-center gap-0.5" href="/fold-test">
                fold test <ArrowUpRight size={14} />
              </Link>{" "}
              first.
            </p>
          </div>
          <div className="mt-10">
            <FoldGuide />
          </div>
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

/** Eight slots, one per page, filling in as the press finishes each one. */
function PrintQueue({ pending, status }: { pending: PageNo[]; status: string }) {
  const done = 8 - pending.length;
  return (
    <div
      className="card mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4 sm:px-6"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={18} className="shrink-0 animate-spin text-riso" />
      <span className="min-w-[12rem] flex-1 text-[0.95rem] text-ink-2">{status}</span>
      <ol className="flex items-end gap-1.5" aria-label={`${done} of 8 pages written`}>
        {([1, 2, 3, 4, 5, 6, 7, 8] as PageNo[]).map((p) => {
          const ready = !pending.includes(p);
          return (
            <li
              key={p}
              className={`grid h-9 w-6 place-items-end justify-center rounded-[3px] pb-0.5 text-[0.6rem] transition-all duration-700 ease-[var(--ease-out-expo)] ${ready ? "bg-ink text-sheet" : "bg-bone-2 text-ink-3 shadow-[inset_0_0_0_1px_var(--color-line-2)]"}`}
            >
              <span className="mono">{p}</span>
            </li>
          );
        })}
      </ol>
      <span className="mono num text-xs text-ink-3">{done}/8</span>
    </div>
  );
}
