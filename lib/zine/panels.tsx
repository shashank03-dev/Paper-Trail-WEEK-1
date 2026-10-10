import {
  contentBox,
  frameBox,
  ispyRows,
  listenLines,
  riddleAnswerBox,
  sensesBox,
  sketchFrame,
  type PageNo,
} from "./layout";
import { HEADER_H, textBox } from "./boxes";
import { RoughShape } from "./rough";
import { CIRCLED, featureLabel, FitText, Line, type PanelProps } from "./primitives";
import { Doodle, QR, Stamp, WeatherGlyph } from "./glyphs";
import { HandMap } from "./map";
import { fitText, fontAttrs } from "./text";
import { compass } from "@/lib/geo";

const WEATHER_WORDS: Record<string, string> = {
  clear: "clear sky",
  "partly-cloudy": "sun & clouds",
  cloudy: "cloudy",
  fog: "foggy",
  drizzle: "drizzle",
  rain: "rain",
  snow: "snow",
  storm: "storm",
};

function Header({ p, title, sub }: { p: PanelProps; title: string; sub?: string }) {
  const cb = contentBox(p.g);
  return (
    <g>
      <Line x={cb.x} y={cb.y + 4.6} text={title} font="display-700" size={5} fill={p.k.ink} />
      {p.k.color && <rect x={cb.x} y={cb.y + 5.6} width={12} height={0.9} fill={p.k.pink} />}
      {sub && (
        <Line
          x={cb.x + cb.w}
          y={cb.y + 4.4}
          text={sub}
          font="mono-400"
          size={1.9}
          fill={p.k.soft}
          anchor="end"
        />
      )}
    </g>
  );
}

function Frame({ p, double }: { p: PanelProps; double?: boolean }) {
  const f = frameBox(p.g);
  return (
    <g>
      <RoughShape
        rc={p.rc}
        d={p.rc.rect(f.x, f.y, f.w, f.h, {
          stroke: p.k.ink,
          strokeWidth: double ? 0.45 : 0.25,
          roughness: double ? 1.3 : 0.8,
        })}
      />
      {double && (
        <RoughShape
          rc={p.rc}
          d={p.rc.rect(f.x + 1.2, f.y + 1.2, f.w - 2.4, f.h - 2.4, {
            stroke: p.k.pink,
            strokeWidth: 0.3,
            roughness: 1.4,
          })}
        />
      )}
    </g>
  );
}

function Folio({ p, n }: { p: PanelProps; n: PageNo }) {
  return (
    <Line
      x={p.g.panelW / 2}
      y={p.g.panelH - 5.2}
      text={`· ${n} ·`}
      font="mono-400"
      size={2.1}
      fill={p.k.soft}
      anchor="middle"
    />
  );
}

/* ---------------------------------- 1 ---------------------------------- */

export function CoverPanel(p: PanelProps) {
  const { d, g, k } = p;
  const cb = contentBox(g);
  const date = new Date(d.date);
  const dateStr = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const title = d.plan?.title ?? "Your trail is being written…";
  const sub = d.plan?.subtitle ?? "";
  const kicker =
    d.panels.cover?.kicker ??
    (d.walkerName ? `A field guide for ${d.walkerName}` : "A field guide for one short walk");
  const blurb = d.panels.cover?.blurb ?? "";
  const titleFit = fitText(title, textBox(g, "coverTitle"));
  const subY = cb.y + 11 + titleFit.height + 1.6;
  return (
    <g>
      <Frame p={p} double />
      <Line
        x={cb.x + 1.5}
        y={cb.y + 3.4}
        text={`No. ${String(d.edition).padStart(3, "0")}`}
        font="mono-500"
        size={2.1}
        fill={k.ink}
      />
      <Line
        x={cb.x + cb.w - 1.5}
        y={cb.y + 3.4}
        text={dateStr}
        font="mono-400"
        size={2.1}
        fill={k.ink}
        anchor="end"
      />
      <FitText
        x={cb.x + 1.5}
        y={cb.y + 6}
        text={kicker.toUpperCase()}
        box={{ ...textBox(g, "coverKicker"), maxW: cb.w - 3 }}
        fill={k.pink}
      />
      <FitText
        x={cb.x + 1.5}
        y={cb.y + 11}
        text={title}
        box={{ ...textBox(g, "coverTitle"), maxW: cb.w - 3 }}
        fill={k.ink}
      />
      {sub && (
        <FitText
          x={cb.x + 1.5}
          y={subY}
          text={sub}
          box={{ ...textBox(g, "coverSubtitle"), maxW: cb.w - 3 }}
          fill={k.ink}
        />
      )}
      <g>
        <WeatherGlyph
          rc={p.rc}
          k={k}
          cx={cb.x + 6.5}
          cy={cb.y + 50}
          s={10}
          condition={d.weather.condition}
        />
        <Line
          x={cb.x + 13}
          y={cb.y + 49}
          text={`${Math.round(d.weather.tempC)}°C`}
          font="display-600"
          size={3.6}
          fill={k.ink}
        />
        <Line
          x={cb.x + 13}
          y={cb.y + 52.6}
          text={`${WEATHER_WORDS[d.weather.condition]} · ${d.durationMin} min loop`}
          font="ui-400"
          size={2.1}
          fill={k.ink}
          maxW={cb.w - 14}
        />
      </g>
      {blurb && (
        <FitText
          x={cb.x + 1.5}
          y={cb.y + 57}
          text={blurb}
          box={{ ...textBox(g, "coverBlurb"), maxW: cb.w - 3 }}
          fill={k.ink}
        />
      )}
      <Stamp
        rc={p.rc}
        cx={cb.x + cb.w / 2}
        cy={cb.y + cb.h - 6}
        w={34}
        h={10}
        angle={-7}
        color={k.pink}
        lines={["PHONE", "STAYS HOME"]}
      />
    </g>
  );
}

/* ---------------------------------- 2 ---------------------------------- */

export function MapPanel(p: PanelProps) {
  const { d, g, k } = p;
  const cb = contentBox(g);
  const box = {
    x: cb.x,
    y: cb.y + HEADER_H + 1,
    w: cb.w,
    h: Math.min(cb.w * 1.08, cb.h - HEADER_H - 14),
  };
  const km = (d.route.totalM / 1000).toFixed(1);
  const y = box.y + box.h;
  return (
    <g>
      <Frame p={p} />
      <Header p={p} title="The Map" sub={d.locationLabel.slice(0, 26)} />
      <HandMap
        rc={p.rc}
        k={k}
        box={box}
        route={d.route}
        ways={d.ways}
        features={d.features}
        clipId={`clip-${d.id}-map`}
      />
      <Line
        x={cb.x}
        y={y + 3.6}
        text={`whole loop ≈ ${Math.round(d.route.totalMin)} min · ${km} km`}
        font="mono-500"
        size={2.2}
        fill={k.ink}
      />
      <Line
        x={cb.x}
        y={y + 7}
        text="★ start & home    ① – ⑥ stops    ┅ your loop"
        font="ui-400"
        size={1.9}
        fill={k.ink}
        maxW={cb.w}
      />
      <Line
        x={cb.x}
        y={cb.y + cb.h + 0.5}
        text="© OpenStreetMap contributors"
        font="mono-400"
        size={1.7}
        fill={k.soft}
      />
    </g>
  );
}

/* ---------------------------------- 3 ---------------------------------- */

export function RoutePanel(p: PanelProps) {
  const { d, g, k, featureById } = p;
  const cb = contentBox(g);
  const n = d.route.waypoints.length;
  const box = textBox(g, "routeStop", { stops: n });
  const per = (cb.h - HEADER_H - 13) / Math.max(1, n);
  const stops = d.route.waypoints.map((w, i) => {
    const copy = d.panels.route?.stops.find((s) => s.stop === i + 1)?.text;
    const f = featureById.get(w.featureId);
    return (
      copy ??
      `Head ${compass(f?.bearingDeg ?? 0)} to ${featureLabel(f)} (${Math.max(1, Math.round(w.legMin))} min).`
    );
  });
  const lostFeature =
    featureById.get(d.panels.route?.ifLost.featureId ?? "") ??
    featureById.get(d.route.waypoints[0]?.featureId ?? "");
  const lost =
    d.panels.route?.ifLost.text ??
    `If you get lost: head toward ${featureLabel(lostFeature)} and you're nearly home.`;
  const lostY = cb.y + cb.h - 11;
  return (
    <g>
      <Frame p={p} />
      <Header p={p} title="The Route" sub={`${n} stops`} />
      {stops.map((text, i) => {
        const y = cb.y + HEADER_H + 2 + i * per;
        return (
          <g key={i}>
            <Line
              x={cb.x + 1.9}
              y={y + 2.9}
              text={CIRCLED[i]}
              font="ui-600"
              size={3.6}
              fill={i + 1 === d.plan?.listenStop ? k.pink : k.ink}
              anchor="middle"
            />
            <FitText x={cb.x + 6.2} y={y + 0.3} text={text} box={box} fill={k.ink} />
          </g>
        );
      })}
      <RoughShape
        rc={p.rc}
        d={p.rc.rect(cb.x, lostY, cb.w, 10, {
          stroke: k.teal,
          strokeWidth: 0.3,
          strokeLineDash: [1, 0.8],
        })}
      />
      <FitText x={cb.x + 2} y={lostY + 1.3} text={lost} box={textBox(g, "ifLost")} fill={k.ink} />
    </g>
  );
}

/* ---------------------------------- 4 ---------------------------------- */

export function IspyPanel(p: PanelProps) {
  const { d, g, k } = p;
  const items = d.plan?.ispy ?? [];
  const rows = ispyRows(g, Math.max(items.length, 8));
  const labelBox = textBox(g, "ispyLabel", { ispyCount: rows.length });
  const hintBox = textBox(g, "ispyHint", { ispyCount: rows.length });
  return (
    <g>
      <Frame p={p} />
      <Header p={p} title="I-Spy" sub="tick what you spot" />
      {rows.map((row, i) => {
        const it = items[i];
        return (
          <g key={i}>
            {/* Thick, exact box: OMR measures ink inside it. */}
            <rect
              x={row.box.x}
              y={row.box.y}
              width={row.box.w}
              height={row.box.h}
              fill="#fff"
              stroke={k.ink}
              strokeWidth={0.6}
              rx={0.6}
            />
            {it && (
              <>
                <Line
                  x={row.textX}
                  y={row.y + row.pitch * 0.47}
                  text={it.label}
                  font="ui-600"
                  size={labelBox.maxSize}
                  fill={k.ink}
                  maxW={row.textW}
                />
                {row.pitch > 6.2 && (
                  <Line
                    x={row.textX}
                    y={row.y + row.pitch * 0.47 + 2.6}
                    text={it.hint}
                    font="ui-400"
                    size={hintBox.maxSize}
                    fill={k.soft}
                    maxW={row.textW}
                  />
                )}
                <Line
                  x={row.pointsX}
                  y={row.y + row.pitch * 0.5 + 0.9}
                  text={String(it.points)}
                  font="mono-500"
                  size={2.6}
                  fill={k.pink}
                  anchor="end"
                />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ---------------------------------- 5 ---------------------------------- */

export function ListenPanel(p: PanelProps) {
  const { d, g, k } = p;
  const cb = contentBox(g);
  const stop = d.plan?.listenStop ?? 4;
  const intro =
    d.panels.listen?.intro ??
    `Stand still at stop ${CIRCLED[stop - 1] ?? stop}. Close your eyes for 60 seconds. Then write down what the street told you.`;
  const sb = sensesBox(g);
  const senses = [
    ["5", "see"],
    ["4", "touch"],
    ["3", "hear"],
    ["2", "smell"],
    ["1", "taste"],
  ];
  return (
    <g>
      <Frame p={p} />
      <Header p={p} title="Listen" sub="60 seconds" />
      <FitText
        x={cb.x}
        y={cb.y + HEADER_H + 1.5}
        text={intro}
        box={textBox(g, "listenIntro")}
        fill={k.ink}
      />
      {listenLines(g).map((l) => (
        <g key={l.key}>
          <Line x={cb.x} y={l.y + 3.6} text={l.label} font="ui-600" size={2.3} fill={k.ink} />
          {l.lines.map((ly, j) => (
            <RoughShape
              key={j}
              rc={p.rc}
              d={p.rc.line(cb.x, ly, cb.x + cb.w, ly, {
                stroke: k.soft,
                strokeWidth: 0.22,
                roughness: 0.5,
              })}
            />
          ))}
        </g>
      ))}
      <RoughShape
        rc={p.rc}
        d={p.rc.rect(sb.x, sb.y, sb.w, sb.h, { stroke: k.teal, strokeWidth: 0.3 })}
      />
      <Line
        x={sb.x + 1.5}
        y={sb.y + 3.4}
        text="5-4-3-2-1 · notice, don't write"
        font="mono-500"
        size={1.9}
        fill={k.teal}
        maxW={sb.w - 3}
      />
      {senses.map(([n, w], i) => {
        const cw = sb.w / 5;
        const x = sb.x + cw * i + cw / 2;
        return (
          <g key={n}>
            <Line
              x={x}
              y={sb.y + 9.4}
              text={n}
              font="display-700"
              size={4.6}
              fill={k.ink}
              anchor="middle"
            />
            <Line
              x={x}
              y={sb.y + 12.8}
              text={w}
              font="ui-400"
              size={2}
              fill={k.ink}
              anchor="middle"
            />
          </g>
        );
      })}
    </g>
  );
}

/* ---------------------------------- 6 ---------------------------------- */

export function RiddlePanel(p: PanelProps) {
  const { d, g, k } = p;
  const cb = contentBox(g);
  const box = riddleAnswerBox(g);
  const text =
    d.plan?.riddle.text ??
    "I stand where you'll pass,\nI never walk away.\nFind me on your loop\nand name me today.";
  const hand = fontAttrs("ui-400");
  return (
    <g>
      <Frame p={p} />
      <Header p={p} title="The Riddle" sub="what am I?" />
      <FitText
        x={cb.x}
        y={cb.y + HEADER_H + 3}
        text={text}
        box={textBox(g, "riddleText")}
        fill={k.ink}
      />
      <RoughShape
        rc={p.rc}
        d={p.rc.rect(box.x, box.y, box.w, box.h, { stroke: k.ink, strokeWidth: 0.45 })}
      />
      <text x={box.x + 2} y={box.y + 3.6} fontFamily={hand.fontFamily} fontSize={2} fill={k.soft}>
        Write your answer here
      </text>
      <RoughShape
        rc={p.rc}
        d={p.rc.line(box.x + 3, box.y + box.h - 5, box.x + box.w - 3, box.y + box.h - 5, {
          stroke: k.soft,
          strokeWidth: 0.22,
          roughness: 0.4,
        })}
      />
      {k.color && (
        <Line
          x={box.x + box.w - 1.5}
          y={box.y + 3.6}
          text="+20"
          font="mono-500"
          size={2.2}
          fill={k.pink}
          anchor="end"
        />
      )}
    </g>
  );
}

/* ---------------------------------- 7 ---------------------------------- */

export function SketchPanel(p: PanelProps) {
  const { d, g, k } = p;
  const cb = contentBox(g);
  const fr = sketchFrame(g);
  const prompt = d.plan?.sketchPrompt ?? "Draw the strangest tree on your route.";
  return (
    <g>
      <Frame p={p} />
      <Header p={p} title="Sketch" sub="no wrong answers" />
      <FitText
        x={cb.x}
        y={cb.y + HEADER_H + 1.5}
        text={prompt}
        box={textBox(g, "sketchPrompt")}
        fill={k.ink}
      />
      <RoughShape
        rc={p.rc}
        d={p.rc.rect(fr.x, fr.y, fr.w, fr.h, { stroke: k.ink, strokeWidth: 0.45, roughness: 1.1 })}
      />
      <Doodle rc={p.rc} k={k} kind={0} x={fr.x - 1.5} y={fr.y - 2.5} s={4.5} />
      <Doodle rc={p.rc} k={k} kind={2} x={fr.x + fr.w - 3} y={fr.y - 2.6} s={4.5} />
      <Doodle rc={p.rc} k={k} kind={3} x={fr.x - 1.2} y={fr.y + fr.h - 3.4} s={4.5} />
      <Doodle rc={p.rc} k={k} kind={1} x={fr.x + fr.w - 3.6} y={fr.y + fr.h - 3.6} s={4.5} />
    </g>
  );
}

/* ---------------------------------- 8 ---------------------------------- */

export function BackPanel(p: PanelProps) {
  const { d, g, k } = p;
  const cb = contentBox(g);
  const qr = 25;
  const blurb =
    d.panels.back?.blurb ??
    "Every line on this sheet points at something real. You found some of it. That counts.";
  const colophon = d.hostedOn
    ? `Written by Gemma 4 (${d.model}) via ${d.hostedOn}. Paper Trail keeps nothing on its server; your trail lives in your browser.`
    : `Written by Gemma 4 (${d.model}) running on ${d.deviceLabel}. Your location never left this machine.`;
  const qrY = cb.y + 27;
  return (
    <g>
      <Frame p={p} />
      <Header p={p} title="Bring me home" />
      <FitText
        x={cb.x}
        y={cb.y + HEADER_H + 1.5}
        text={blurb}
        box={textBox(g, "backBlurb")}
        fill={k.ink}
      />
      <QR text={d.returnUrl} x={cb.x + (cb.w - qr) / 2} y={qrY} size={qr} color={k.ink} />
      <FitText
        x={cb.x + cb.w / 2}
        y={qrY + qr + 1.5}
        text="Unfold me, take one photo of this side, and Paper Trail will read me."
        box={{
          font: "display-400i",
          maxSize: 2.7,
          minSize: 2.2,
          maxW: cb.w,
          maxH: 7,
          lineHeight: 1.2,
        }}
        fill={k.ink}
        anchor="middle"
      />
      <FitText
        x={cb.x}
        y={cb.y + cb.h - 12}
        text={colophon}
        box={{
          font: "mono-400",
          maxSize: 1.8,
          minSize: 1.6,
          maxW: cb.w,
          maxH: 6.5,
          lineHeight: 1.3,
        }}
        fill={k.soft}
      />
      <Line
        x={cb.x}
        y={cb.y + cb.h - 3.2}
        text="Paper Trail · open source · MIT"
        font="mono-500"
        size={1.9}
        fill={k.ink}
      />
      <Line
        x={cb.x}
        y={cb.y + cb.h - 0.4}
        text={d.repoUrl.replace(/^https?:\/\//, "")}
        font="mono-400"
        size={1.6}
        fill={k.soft}
        maxW={cb.w}
      />
    </g>
  );
}

export const PANEL_COMPONENTS: Record<PageNo, (p: PanelProps) => React.ReactElement> = {
  1: CoverPanel,
  2: MapPanel,
  3: RoutePanel,
  4: IspyPanel,
  5: ListenPanel,
  6: RiddlePanel,
  7: SketchPanel,
  8: BackPanel,
};

export { Folio };
