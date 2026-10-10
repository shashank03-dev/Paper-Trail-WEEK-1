import type { Gray } from "./image";
import { adaptiveThreshold, downscaleGray } from "./image";
import type { Pt } from "./homography";

export interface Blob {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  area: number;
  cx: number;
  cy: number;
}

/** 4-connected components of a binary mask (1 = dark). */
export function components(mask: Uint8Array, w: number, h: number, minArea = 12): Blob[] {
  const labels = new Int32Array(w * h);
  const blobs: Blob[] = [];
  const stack = new Int32Array(w * h);
  let next = 1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || labels[i]) continue;
    let sp = 0;
    stack[sp++] = i;
    labels[i] = next;
    let x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0,
      area = 0,
      sx = 0,
      sy = 0;
    while (sp) {
      const p = stack[--sp]!;
      const x = p % w;
      const y = (p - x) / w;
      area++;
      sx += x;
      sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) {
        labels[p - 1] = next;
        stack[sp++] = p - 1;
      }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) {
        labels[p + 1] = next;
        stack[sp++] = p + 1;
      }
      if (y > 0 && mask[p - w] && !labels[p - w]) {
        labels[p - w] = next;
        stack[sp++] = p - w;
      }
      if (y < h - 1 && mask[p + w] && !labels[p + w]) {
        labels[p + w] = next;
        stack[sp++] = p + w;
      }
    }
    if (area >= minArea) blobs.push({ x0, y0, x1, y1, area, cx: sx / area, cy: sy / area });
    next++;
  }
  return blobs;
}

/** A fiducial is a dark square ring: square bbox, ~75% filled, light centre. */
export function isFiducial(b: Blob, mask: Uint8Array, w: number, minDim: number): boolean {
  const bw = b.x1 - b.x0 + 1;
  const bh = b.y1 - b.y0 + 1;
  if (bw < 6 || bh < 6) return false;
  if (bw > minDim * 0.16 || bh > minDim * 0.16) return false;
  const aspect = bw / bh;
  if (aspect < 0.55 || aspect > 1.8) return false;
  const fill = b.area / (bw * bh);
  if (fill < 0.5 || fill > 0.93) return false;
  // Centre must be light (the white inner square).
  const cx = Math.round((b.x0 + b.x1) / 2);
  const cy = Math.round((b.y0 + b.y1) / 2);
  let dark = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) dark += mask[(cy + dy) * w + cx + dx] ?? 0;
  return dark <= 2;
}

export interface Detection {
  corners: Pt[] | null; // tl, tr, br, bl in image px
  confidence: number;
  candidates: Pt[];
}

/** Find the 4 printed corner markers. Returns best guess + confidence. */
export function detectFiducials(gray: Gray, maxSide = 1200): Detection {
  const { img, scale } = downscaleGray(gray, maxSide);
  const minDim = Math.min(img.width, img.height);
  const mask = adaptiveThreshold(img, Math.max(15, Math.round(minDim / 10)) | 1, 14);
  const blobs = components(mask, img.width, img.height).filter((b) =>
    isFiducial(b, mask, img.width, minDim),
  );
  const cands = blobs.map((b) => ({ x: b.cx, y: b.cy, size: (b.x1 - b.x0 + b.y1 - b.y0 + 2) / 2 }));
  const candidates = cands.map((c) => ({ x: c.x * scale, y: c.y * scale }));
  if (cands.length < 4) return { corners: null, confidence: 0, candidates };
  const pick = (score: (c: { x: number; y: number }) => number) =>
    cands.reduce((a, b) => (score(b) > score(a) ? b : a));
  const tl = pick((c) => -(c.x + c.y));
  const tr = pick((c) => c.x - c.y);
  const br = pick((c) => c.x + c.y);
  const bl = pick((c) => c.y - c.x);
  const quad = [tl, tr, br, bl];
  if (new Set(quad).size < 4) return { corners: null, confidence: 0.1, candidates };
  const sizes = quad.map((q) => q.size);
  const sizeRatio = Math.max(...sizes) / Math.min(...sizes);
  const area = Math.abs(polyArea(quad)) / (img.width * img.height);
  const convex = isConvex(quad);
  let confidence = 1;
  if (!convex) confidence = 0.1;
  if (sizeRatio > 2.2) confidence *= 0.4;
  if (area < 0.15) confidence *= 0.4;
  return {
    corners: quad.map((q) => ({ x: (q.x + 0.5) * scale, y: (q.y + 0.5) * scale })),
    confidence,
    candidates,
  };
}

function polyArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i]!.x * p[j]!.y - p[j]!.x * p[i]!.y;
  }
  return a / 2;
}

function isConvex(p: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    const c = p[(i + 2) % p.length]!;
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (z !== 0) {
      if (sign && Math.sign(z) !== sign) return false;
      sign = Math.sign(z);
    }
  }
  return true;
}

/** Best-guess corners when detection fails: a slightly inset rectangle. */
export function defaultCorners(w: number, h: number): Pt[] {
  const mx = w * 0.06;
  const my = h * 0.06;
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my },
  ];
}
