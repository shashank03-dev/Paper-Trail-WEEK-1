"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CornerEditor } from "@/components/CornerEditor";
import { FieldReport } from "@/components/FieldReport";
import { ArrowRight, Camera, Check, ImageUp, Loader2 } from "lucide-react";
import { db } from "@/lib/client/db";
import { screenMs as screenMsOf } from "@/lib/client/db";
import { postSSE } from "@/lib/client/api";
import { fileToRGBA, rgbaToDataURL } from "@/lib/client/raster";
import { useScreenTime } from "@/lib/client/useScreenTime";
import { detect, processPhoto } from "@/lib/vision/sheet";
import { defaultCorners } from "@/lib/vision/fiducials";
import type { Pt } from "@/lib/vision/homography";
import type { RGBA } from "@/lib/vision/image";
import type { Expected, FieldReport as Report, Paper } from "@/lib/schemas";
import { score } from "@/lib/reader/score";
import type { PageNo } from "@/lib/zine/layout";

type Step = "upload" | "corners" | "reading" | "report";
const READ_PAGES: { page: PageNo; label: string }[] = [
  { page: 4, label: "I-Spy ticks" },
  { page: 5, label: "Listen notes" },
  { page: 6, label: "Riddle answer" },
  { page: 7, label: "Sketch" },
];
const OUTSIDE_CAP = 3 * 60 * 60 * 1000;

export default function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const trail = useLiveQuery(
    () =>
      db()
        .trails.get(id)
        .then((t) => t ?? null),
    [id],
  );
  const [step, setStep] = useState<Step>("upload");
  const [photo, setPhoto] = useState<{ img: RGBA; src: string; at: number } | null>(null);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [conf, setConf] = useState(0);
  const [panels, setPanels] = useState<Partial<Record<PageNo, string>>>({});
  const [reading, setReading] = useState<PageNo | 0 | null>(null);
  const [notes, setNotes] = useState<Partial<Record<PageNo, string>>>({});
  const [report, setReport] = useState<Report | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [screen, setScreen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useScreenTime(trail ? id : null, "return");

  useEffect(() => setDebug(new URLSearchParams(window.location.search).get("debug") === "1"), []);
  // A trail that was already read opens straight onto its report.
  useEffect(() => {
    if (trail?.report && step === "upload" && !photo) {
      setReport(trail.report);
      setLabels(trail.labels ?? trail.plan?.ispy.map((i) => i.label) ?? []);
      setStep("report");
      void screenMsOf(id).then(setScreen);
    }
  }, [trail, step, photo, id]);

  const expected: Expected | null = useMemo(
    () =>
      trail?.plan
        ? {
            ispy: trail.plan.ispy.map((i) => ({ label: i.label, points: i.points })),
            riddle: {
              text: trail.plan.riddle.text,
              answer: trail.plan.riddle.answer,
              acceptable: trail.plan.riddle.acceptable,
            },
            sketchPrompt: trail.plan.sketchPrompt,
            listenStop: trail.plan.listenStop,
            ...(trail.walkerName ? { walkerName: trail.walkerName } : {}),
            title: trail.plan.title,
          }
        : null,
    [trail],
  );

  const onFile = async (file: Blob) => {
    setError(null);
    try {
      const img = await fileToRGBA(file);
      const src = rgbaToDataURL(img, "image/jpeg", 0.85);
      setPhoto({ img, src, at: Date.now() });
      const d = detect(img);
      setConf(d.confidence);
      setCorners(
        d.corners && d.confidence >= 0.5 ? d.corners : defaultCorners(img.width, img.height),
      );
      setStep("corners");
    } catch (e) {
      setError(`Couldn't open that photo (${(e as Error).message}).`);
    }
  };

  const useSample = async () => {
    const r = await fetch("/samples/filled-sheet.jpg");
    if (!r.ok) return setError("No sample photo is bundled. Run `pnpm fixtures:photos`.");
    await onFile(await r.blob());
  };

  const guessPaper = (c: Pt[]): Paper => {
    if (trail) return trail.paper;
    const w =
      (Math.hypot(c[1]!.x - c[0]!.x, c[1]!.y - c[0]!.y) +
        Math.hypot(c[2]!.x - c[3]!.x, c[2]!.y - c[3]!.y)) /
      2;
    const h =
      (Math.hypot(c[3]!.x - c[0]!.x, c[3]!.y - c[0]!.y) +
        Math.hypot(c[2]!.x - c[1]!.x, c[2]!.y - c[1]!.y)) /
      2;
    return Math.abs(w / h - 1.324) < Math.abs(w / h - 1.458) ? "letter" : "a4";
  };

  const read = async () => {
    if (!photo) return;
    setStep("reading");
    setError(null);
    await new Promise((r) => setTimeout(r, 60)); // let the UI paint before the warp
    const n = expected?.ispy.length ?? 10;
    const proc = processPhoto(photo.img, guessPaper(corners), corners, n);
    const urls: Partial<Record<PageNo, string>> = {};
    for (const { page } of READ_PAGES) urls[page] = rgbaToDataURL(proc.panels[page]);
    setPanels(urls);
    setReading(4);
    try {
      let final: { report: Report; labels: string[] } | null = null;
      await postSSE(
        "/api/read",
        { trailId: id, panelImages: urls, expected, omr: proc.omr, mode: "per-panel+omr" },
        (e) => {
          if (e.type === "step") {
            const page = Number(e.page) as PageNo | 0;
            if (page === 4)
              setNotes((x) => ({
                ...x,
                4: `${(e.ispy as Report["ispy"]).filter((i) => i.spotted).length} ticked`,
              }));
            if (page === 5)
              setNotes((x) => ({ ...x, 5: (e.listen as Report["listen"]).loudest ?? "…" }));
            if (page === 6)
              setNotes((x) => ({ ...x, 6: (e.riddle as Report["riddle"]).written ?? "blank" }));
            if (page === 7) setNotes((x) => ({ ...x, 7: "described" }));
            setReading(page === 4 ? 5 : page === 5 ? 6 : page === 6 ? 7 : page === 7 ? 0 : null);
          }
          if (e.type === "report")
            final = { report: e.report as Report, labels: e.labels as string[] };
          if (e.type === "error") throw new Error(String(e.error));
        },
      );
      if (!final) throw new Error("The reader didn't send a report.");
      const { report: rep, labels: lab } = final as { report: Report; labels: string[] };
      const screenTotal = await screenMsOf(id);
      setScreen(screenTotal);
      setReport(rep);
      setLabels(lab.length ? lab : (expected?.ispy.map((i) => i.label) ?? []));
      if (trail) {
        const outsideMs = trail.printedAt
          ? Math.min(OUTSIDE_CAP, Math.max(0, photo.at - trail.printedAt))
          : undefined;
        const thumb = rgbaToDataURL(proc.panels[7], "image/jpeg", 0.6);
        const sc = score(rep, trail.plan?.ispy.map((i) => i.points) ?? []);
        await db().trails.update(id, {
          report: rep,
          labels: lab,
          returnedAt: photo.at,
          ...(outsideMs !== undefined ? { outsideMs } : {}),
          score: sc,
          stamp: { text: trail.plan?.title ?? "Trail", date: photo.at, points: sc.total },
          sketchThumb: thumb,
        });
      }
      setStep("report");
    } catch (e) {
      setError((e as Error).message);
      setStep("corners");
    } finally {
      setReading(null);
    }
  };

  const updateReport = async (r: Report) => {
    setReport(r);
    if (trail)
      await db().trails.update(id, {
        report: r,
        score: score(r, trail.plan?.ispy.map((i) => i.points) ?? []),
      });
  };

  if (trail === undefined)
    return <p className="mx-auto max-w-5xl px-6 pb-20 pt-40 text-ink-3">Unfolding…</p>;

  const points = trail?.plan?.ispy.map((i) => i.points) ?? labels.map(() => 10);
  const outsideMs =
    trail?.outsideMs ??
    (trail?.printedAt && photo ? Math.min(OUTSIDE_CAP, photo.at - trail.printedAt) : null);
  const STEPS = ["Photo", "Corners", "Reading", "Report"];
  const stepIndex = { upload: 0, corners: 1, reading: 2, report: 3 }[step];

  return (
    <div className="mx-auto max-w-7xl px-[var(--gutter)] pb-16 pt-32 sm:pt-40">
      {step !== "report" && (
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="label folio">{trail?.plan?.title ?? "Paper Trail"}</p>
            <h1 className="display mt-6 text-[clamp(3rem,1.6rem+5vw,6.2rem)]">
              Welcome <em className="text-riso">back.</em>
            </h1>
          </div>
          <ol className="flex flex-wrap items-center gap-2" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={`mono flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.06em] ${i === stepIndex ? "text-ink" : i < stepIndex ? "text-riso" : "text-ink-3"}`}
                aria-current={i === stepIndex ? "step" : undefined}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-[0.66rem] transition-colors duration-500 ${i < stepIndex ? "bg-riso text-white" : i === stepIndex ? "bg-ink text-sheet" : "shadow-[inset_0_0_0_1px_var(--color-line-2)]"}`}
                >
                  {i < stepIndex ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                {label}
                {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-line-2" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
      )}
      {!trail && (
        <p className="notice notice-warn mt-8 max-w-2xl" role="note">
          This trail lives on the device that made it. Open this link there, or upload the photo
          here and we&rsquo;ll read it anyway.
        </p>
      )}

      {step === "upload" && (
        <section className="mt-14 grid items-center gap-14 md:grid-cols-[1fr_1.05fr]">
          <div>
            <p className="lede max-w-md">
              Unfold your sheet and take one photo of the printed side. Lay it flat in good light,
              with all four black corner squares in the frame.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-riso btn-lg"
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={18} strokeWidth={1.7} /> Take or upload a photo
              </button>
              <button type="button" className="btn btn-sheet btn-lg" onClick={useSample}>
                Try a sample photo
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label="Photo of your filled-in sheet"
              data-testid="photo-input"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <p className="mono mt-8 max-w-md text-[0.74rem] leading-relaxed text-ink-3">
              The photo is read by {trail?.model ?? "Gemma"}
              {trail?.hostedOn ? ` via ${trail.hostedOn}` : " on your configured endpoint"}. It
              isn&rsquo;t stored anywhere else.
            </p>
          </div>
          {/* A drop zone shaped like the sheet it wants: four corner squares and eight panels. */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void onFile(f);
            }}
            aria-label="Drop a photo of your sheet here, or choose one"
            className="group relative mx-auto w-full max-w-lg [perspective:1600px]"
          >
            <div
              className={`paper relative aspect-[1.29] w-full overflow-hidden transition-transform duration-700 ease-[var(--ease-out-expo)] ${dragging ? "[transform:rotateX(0deg)_rotateZ(0deg)_scale(1.03)]" : "[transform:rotateX(24deg)_rotateZ(-5deg)] group-hover:[transform:rotateX(14deg)_rotateZ(-3deg)]"}`}
            >
              <div className="absolute inset-[7%] grid grid-cols-4 grid-rows-2 gap-[2.5%]">
                {Array.from({ length: 8 }, (_, i) => (
                  <div
                    key={i}
                    className={`rounded-[2px] transition-colors duration-500 ${dragging ? "bg-riso/10 shadow-[inset_0_0_0_1px_rgb(43_61_216/0.4)]" : "shadow-[inset_0_0_0_1px_rgb(21_20_18/0.14)]"}`}
                  />
                ))}
              </div>
              {[
                "left-[3%] top-[4%]",
                "right-[3%] top-[4%]",
                "left-[3%] bottom-[4%]",
                "right-[3%] bottom-[4%]",
              ].map((pos) => (
                <span
                  key={pos}
                  className={`absolute h-[7%] w-[5.4%] bg-ink ${pos} shadow-[inset_0_0_0_3px_#fffdf8,inset_0_0_0_6px_#151412]`}
                />
              ))}
              <span className="absolute inset-0 grid place-items-center">
                <span
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-[0.88rem] font-medium shadow-[0_10px_30px_-12px_rgb(21_20_18/0.5)] transition-colors duration-300 ${dragging ? "bg-riso text-white" : "bg-ink text-sheet"}`}
                >
                  <ImageUp size={16} /> {dragging ? "Drop it" : "Drop the photo here"}
                </span>
              </span>
            </div>
            <span className="label mt-8 block text-center">Get all four corner squares in</span>
          </button>
        </section>
      )}

      {step === "corners" && photo && (
        <section className="mt-12" aria-labelledby="corners-h">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="corners-h" className="title text-[2.2rem]">
                {conf >= 0.5 ? (
                  <span data-testid="corners-found" className="inline-flex items-center gap-3">
                    Corners found{" "}
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-moss text-white">
                      <Check size={18} strokeWidth={2.5} />
                    </span>
                  </span>
                ) : (
                  "Drag the dots onto the four corner squares"
                )}
              </h2>
              <p className="mt-2 text-ink-2">
                {conf >= 0.5
                  ? "Nudge them if they look off, then read the sheet."
                  : "We couldn't spot all four marks. Put each dot on the middle of a corner square."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn btn-sheet" onClick={() => setStep("upload")}>
                Retake
              </button>
              <button type="button" className="btn btn-riso" onClick={read} data-testid="read">
                Read my sheet
                <span className="knob" aria-hidden>
                  <ArrowRight size={16} />
                </span>
              </button>
            </div>
          </div>
          <div className="mt-8 rounded-[28px] bg-dark p-3 sm:p-6">
            <CornerEditor
              src={photo.src}
              width={photo.img.width}
              height={photo.img.height}
              corners={corners}
              onChange={setCorners}
              snapped={conf >= 0.5}
            />
          </div>
        </section>
      )}

      {step === "reading" && (
        <section
          data-surface="dark"
          className="mt-12 rounded-[28px] bg-dark p-6 text-dark-fg sm:p-10"
          aria-live="polite"
          aria-labelledby="reading-h"
        >
          <h2 id="reading-h" className="title flex items-center gap-3 text-[2rem]">
            <Loader2 size={20} className="animate-spin text-safelight" /> Reading your pencil…
          </h2>
          <p className="mt-2 text-dark-fg-2">
            Four pages, one at a time. The tick-counter checks every box as well.
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-4">
            {READ_PAGES.map(({ page, label }) => (
              <li key={page} className="flex flex-col gap-3">
                <div
                  className={`overflow-hidden rounded-[4px] bg-[#fffdf8] transition-shadow duration-500 ${reading === page ? "scan shadow-[0_0_0_2px_#ff6a4d,0_0_40px_-6px_rgb(255_106_77/0.6)]" : ""}`}
                >
                  {panels[page] ? (
                    <img
                      src={panels[page]}
                      alt={`Page ${page}: ${label}`}
                      className="block w-full"
                    />
                  ) : (
                    <div className="aspect-[0.65] animate-pulse bg-dark-2" />
                  )}
                </div>
                <p className="text-[0.9rem] text-dark-fg-2">
                  <span className="mono text-[0.68rem] uppercase tracking-[0.08em] text-safelight">
                    page {page}
                  </span>{" "}
                  <span className="block font-medium text-dark-fg">{label}</span>
                  <span className="hand block min-h-[1.6em] text-[1.4rem] leading-tight text-dark-fg">
                    {notes[page] ?? (reading === page ? "reading…" : "")}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          {reading === 0 && (
            <p className="mt-6 text-[0.92rem] text-dark-fg-2">The Trail Office is writing back…</p>
          )}
        </section>
      )}

      {step === "report" && report && (
        <div>
          <FieldReport
            title={trail?.plan?.title ?? "Your trail"}
            date={trail?.returnedAt ?? Date.now()}
            report={report}
            labels={labels}
            points={points}
            screenMs={screen}
            outsideMs={outsideMs ?? null}
            sketchSrc={trail?.sketchThumb ?? panels[7]}
            debug={debug}
            inBook={!!trail?.inBook}
            trailId={id}
            onChange={updateReport}
            onAddToBook={() => void (trail ? db().trails.update(id, { inBook: true }) : undefined)}
          />
          {!trail && (
            <p className="mt-4 text-[0.9rem] text-ink-3">
              This report isn&rsquo;t saved: the trail lives on another device.
            </p>
          )}
          <p className="mt-14 text-center">
            <Link href="/book" className="link text-ink-2 hover:text-ink">
              Open your Trail Book →
            </Link>
          </p>
        </div>
      )}

      {error && (
        <p className="notice notice-error mt-6" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
