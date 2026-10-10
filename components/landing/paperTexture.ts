import * as THREE from "three";

/** A tiny seeded PRNG so the paper grain is the same on every load. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uncoated paper, drawn in code: a warm wash, a few thousand fibres and some flecks. */
export function drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number, base = "#f3eee3") {
  const r = mulberry(7);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, "rgba(255,255,255,0.25)");
  wash.addColorStop(0.5, "rgba(255,255,255,0.03)");
  wash.addColorStop(1, "rgba(110,92,66,0.07)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 180; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = 4 + r() * 26;
    ctx.strokeStyle =
      r() > 0.45
        ? `rgba(255,255,255,${0.03 + r() * 0.05})`
        : `rgba(96,80,58,${0.02 + r() * 0.035})`;
    ctx.lineWidth = 0.4 + r() * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (r() - 0.5) * 2);
    ctx.stroke();
  }
  for (let i = 0; i < (w * h) / 400; i++) {
    const tone = Math.round(110 + r() * 90);
    ctx.fillStyle = `rgba(${tone},${tone - 6},${tone - 14},${0.02 + r() * 0.03})`;
    const s = 0.5 + r() * 1.1;
    ctx.fillRect(r() * w, r() * h, s, s);
  }
}

let back: THREE.CanvasTexture | null = null;
/** The unprinted back of the sheet (shared). */
export function paperBackTexture(): THREE.CanvasTexture {
  if (back) return back;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  drawPaper(c.getContext("2d")!, 512, 512);
  back = new THREE.CanvasTexture(c);
  back.colorSpace = THREE.SRGBColorSpace;
  back.wrapS = back.wrapT = THREE.RepeatWrapping;
  return back;
}
