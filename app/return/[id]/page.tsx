"use client";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CornerEditor } from "@/components/CornerEditor";
import { FieldReport } from "@/components/FieldReport";
import { Icon3D } from "@/components/Icon3D";
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
    return <p className="mx-auto max-w-5xl px-6 py-20 text-muted">Unfolding…</p>;

  const points = trail?.plan?.ispy.map((i) => i.points) ?? labels.map(() => 10);
  const outsideMs =
    trail?.outsideMs ??
    (trail?.printedAt && photo ? Math.min(OUTSIDE_CAP, photo.at - trail.printedAt) : null);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-2 sm:px-6">
      {step !== "report" && (
        <>
          <p className="kicker">{trail?.plan?.title ?? "Paper Trail"} · return</p>
          <h1 className="display riso mt-1 text-4xl sm:text-5xl">Welcome back.</h1>
        </>
      )}
      {!trail && (
        <p
          className="mt-4 max-w-2xl rounded-xl border-2 border-sun bg-[#fff6dc] px-4 py-3 text-sm"
          role="note"
        >
          This trail lives on the device that made it. Open this link there, or upload the photo
          here and I&rsquo;ll read it anyway.
        </p>
      )}

      {step === "upload" && (
        <section className="mt-8 grid items-center gap-8 md:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-lg leading-relaxed">
              Unfold your sheet and take one photo of the printed side. Lay it flat, get all four
              black corner squares in the frame, and avoid harsh shadows.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary btn-xl"
                onClick={() => fileRef.current?.click()}
              >
                <Icon3D name="camera" size={30} /> Take or upload a photo
              </button>
              <button type="button" className="btn" onClick={useSample}>
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
            <p className="mono mt-4 text-xs text-muted">
              The photo is read by {trail?.model ?? "Gemma"} at your configured endpoint. It is not
              stored anywhere else.
            </p>
          </div>
          <div className="relative grid place-items-center">
            <div className="stage">
              <div className="paper-card grid aspect-[1.3] w-72 rotate-[-6deg] place-items-center bg-card [transform:rotateX(22deg)_rotateZ(-8deg)]">
                <Icon3D name="pencil" size={90} float tilt={14} />
              </div>
            </div>
            <Icon3D
              name="camera"
              size={84}
              float
              tilt={-10}
              className="float-delay-2 absolute -top-4 right-6"
            />
          </div>
        </section>
      )}

      {step === "corners" && photo && (
        <section className="mt-6" aria-labelledby="corners-h">
          <h2 id="corners-h" className="display text-2xl">
            {conf >= 0.5 ? (
              <span data-testid="corners-found">
                Corners found <span className="text-teal">✓</span>
              </span>
            ) : (
              "Drag the dots onto the four black corner squares"
            )}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {conf >= 0.5
              ? "Adjust if they look off, then read."
              : "We couldn't spot all four markers. Place each dot on the centre of a corner square."}
          </p>
          <div className="mt-4">
            <CornerEditor
              src={photo.src}
              width={photo.img.width}
              height={photo.img.height}
              corners={corners}
              onChange={setCorners}
              snapped={conf >= 0.5}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary btn-xl"
              onClick={read}
              data-testid="read"
            >
              <Icon3D name="magnifier" size={28} /> Read my sheet
            </button>
            <button type="button" className="btn" onClick={() => setStep("upload")}>
              Retake
            </button>
          </div>
        </section>
      )}

      {step === "reading" && (
        <section className="mt-8" aria-live="polite" aria-labelledby="reading-h">
          <h2 id="reading-h" className="display text-2xl">
            Gemma is reading your pencil…
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {READ_PAGES.map(({ page, label }) => (
              <li key={page} className="flex flex-col gap-2">
                <div
                  className={`paper-card overflow-hidden ${reading === page ? "scan ring-4 ring-teal" : ""}`}
                >
                  {panels[page] ? (
                    <img
                      src={panels[page]}
                      alt={`Page ${page}: ${label}`}
                      className="block w-full"
                    />
                  ) : (
                    <div className="aspect-[0.66] animate-pulse bg-desk" />
                  )}
                </div>
                <p className="text-sm">
                  <span className="font-semibold">{label}</span>{" "}
                  <span className="hand text-xl text-teal">
                    {notes[page] ?? (reading === page ? "reading…" : "")}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          {reading === 0 && (
            <p className="mt-4 text-sm text-muted">The Trail Office is writing back…</p>
          )}
        </section>
      )}

      {step === "report" && report && (
        <div className="mt-2">
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
            <p className="mt-4 text-sm text-muted">
              This report isn&rsquo;t saved: the trail lives on another device.
            </p>
          )}
          <p className="mt-8 text-center">
            <Link href="/book" className="underline">
              Open your Trail Book →
            </Link>
          </p>
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
    </div>
  );
}
