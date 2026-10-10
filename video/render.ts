/**
 * Renders the launch video. The scene (video/scene) is a web page whose every
 * frame is a pure function of time, window.seek(t). This script serves it,
 * drives it with Playwright one frame at a time and pipes the frames to ffmpeg.
 *
 *   pnpm video:render                        # both cuts, full quality
 *   pnpm video:render --format 16x9          # one cut
 *   pnpm video:render --stills 0.5,3,7.2     # PNG stills only (fast checks)
 *   pnpm video:render --subframes 1          # no motion blur (fast draft)
 *
 * Needs video/build/zine.json (pnpm video:zine) and the audio from
 * video/audio (see video/README.md); without the mix it renders silent.
 */
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import ts from "typescript";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";

const ROOT = resolve(".");
const OUT = "video/out";
const FORMATS = { "16x9": [1920, 1080], "4x5": [1080, 1350] } as const;
type Format = keyof typeof FORMATS;
const cues = JSON.parse(readFileSync("video/cues.json", "utf8")) as {
  fps: number;
  duration: number;
  blur: [number, number][];
};

const arg = (k: string, d?: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

/** TypeScript → browser modules on the fly: "@/x" and extensionless imports get real paths. */
function transpile(file: string): string {
  const out = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return out.replace(/(from\s+|import\s*\(\s*)"([^"]+)"/g, (m, pre: string, spec: string) => {
    if (spec.startsWith("@/")) return `${pre}"/${spec.slice(2)}.ts"`;
    if (spec.startsWith(".") && !extname(spec)) return `${pre}"${spec}.ts"`;
    return m;
  });
}

function serve(): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]!));
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    if (file.endsWith(".ts")) {
      res.writeHead(200, { "content-type": "text/javascript" }).end(transpile(file));
      return;
    }
    res
      .writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" })
      .end(readFileSync(file));
  });
  return new Promise((ok) =>
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      ok({ server, port: typeof a === "object" && a ? a.port : 0 });
    }),
  );
}

async function render(format: Format, port: number) {
  const [w, h] = FORMATS[format];
  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
  await page.goto(`http://127.0.0.1:${port}/video/scene/index.html?format=${format}`);
  await page.waitForFunction(
    () => (window as unknown as { ready?: boolean }).ready === true,
    null,
    {
      timeout: 120_000,
    },
  );
  const seek = (t: number) =>
    page.evaluate((tt) => (window as unknown as { seek: (t: number) => void }).seek(tt), t);

  const stills = arg("stills");
  if (stills) {
    const dir = join(OUT, "stills");
    mkdirSync(dir, { recursive: true });
    for (const s of stills.split(",").map(Number)) {
      const a = Date.now();
      await seek(s);
      const b = Date.now();
      await page.screenshot({ type: "jpeg", quality: 95 });
      const c = Date.now();
      await page.screenshot({ path: join(dir, `${format}-${s.toFixed(2)}.png`) });
      if (arg("timing"))
        console.log(`${s}s: seek ${b - a} ms, paint+jpeg ${c - b} ms, png ${Date.now() - c} ms`);
    }
    console.log(`${format}: stills → ${dir}`);
    await browser.close();
    return;
  }

  const fps = cues.fps;
  const n = Math.round(cues.duration * fps);
  // Motion blur: each frame averages sub-frames spread across its 1/60 s. Fast moves (listed in
  // cues.json "blur") get more of them so they smear smoothly instead of showing ghost copies.
  const slow = Number(arg("subframes", "2"));
  const fast = Number(arg("subframes-fast", "5"));
  const subAt = (t: number) =>
    cues.blur.some(([a, b]) => t >= a && t <= b) ? Math.max(fast, slow) : slow;
  mkdirSync(OUT, { recursive: true });
  const silent = join(OUT, `.paper-trail-${format}-video.mp4`);
  const ff = spawn(
    "ffmpeg",
    [
      ...["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${w}x${h}`],
      ...["-framerate", String(fps), "-i", "-", "-vf", "format=yuv420p"],
      ...["-c:v", "libx264", "-preset", "slow", "-crf", "14", "-tune", "animation"],
      ...["-movflags", "+faststart", silent],
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const acc = new Float32Array(w * h * 3);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const sub = subAt(i / fps);
    acc.fill(0);
    for (let j = 0; j < sub; j++) {
      const t = (i + (j - (sub - 1)) / sub) / fps;
      await seek(Math.max(0, t));
      const { data } = PNG.sync.read(await page.screenshot({ type: "png" }));
      for (let p = 0, q = 0; p < data.length; p += 4, q += 3) {
        acc[q] = acc[q]! + data[p]!;
        acc[q + 1] = acc[q + 1]! + data[p + 1]!;
        acc[q + 2] = acc[q + 2]! + data[p + 2]!;
      }
    }
    const frame = Buffer.allocUnsafe(acc.length);
    for (let q = 0; q < acc.length; q++) frame[q] = Math.round(acc[q]! / sub);
    if (!ff.stdin.write(frame)) await new Promise((ok) => ff.stdin.once("drain", ok));
    if (i % 60 === 0) process.stdout.write(`\r${format}: ${i}/${n} frames`);
  }
  ff.stdin.end();
  await new Promise((ok) => ff.on("close", ok));
  await browser.close();
  console.log(`\r${format}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  mux(format, silent);
}

/** Put the mixed soundtrack under the picture; exactly the video's length. */
function mux(format: Format, silent: string) {
  const mix = "video/out/paper-trail-mix.wav";
  const file = join(OUT, `paper-trail-launch-${format === "16x9" ? "1920x1080" : "1080x1350"}.mp4`);
  const audio = existsSync(mix)
    ? ["-i", mix, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "256k"]
    : [];
  const r = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-i",
      silent,
      ...audio,
      "-c:v",
      "copy",
      "-t",
      String(cues.duration),
      "-movflags",
      "+faststart",
      file,
    ],
    { stdio: "inherit" },
  );
  r.on("close", () => console.log(`→ ${file}${audio.length ? "" : " (silent: no mix yet)"}`));
}

async function main() {
  const { server, port } = await serve();
  const which = arg("format");
  const formats = (which ? [which] : Object.keys(FORMATS)) as Format[];
  try {
    for (const f of formats) await render(f, port);
  } finally {
    server.close();
  }
}

void main();
