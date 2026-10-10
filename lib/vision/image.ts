/** Minimal RGBA image type that works in the browser (ImageData) and in Node. */
export interface RGBA {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export interface Gray {
  width: number;
  height: number;
  data: Uint8Array;
}

export function createRGBA(width: number, height: number, fill = 255): RGBA {
  const data = new Uint8ClampedArray(width * height * 4).fill(fill);
  return { width, height, data };
}

export function toGray(img: RGBA): Gray {
  const out = new Uint8Array(img.width * img.height);
  const d = img.data;
  for (let i = 0, j = 0; j < out.length; i += 4, j++)
    out[j] = (d[i]! * 77 + d[i + 1]! * 150 + d[i + 2]! * 29) >> 8;
  return { width: img.width, height: img.height, data: out };
}

/** Box-filter downscale of a gray image by an integer-ish factor. */
export function downscaleGray(g: Gray, maxSide: number): { img: Gray; scale: number } {
  const s = Math.max(g.width, g.height) / maxSide;
  if (s <= 1) return { img: g, scale: 1 };
  const w = Math.round(g.width / s);
  const h = Math.round(g.height / s);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * s);
    const y1 = Math.min(g.height, Math.floor((y + 1) * s));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * s);
      const x1 = Math.min(g.width, Math.floor((x + 1) * s));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          sum += g.data[yy * g.width + xx]!;
          n++;
        }
      out[y * w + x] = n ? sum / n : 255;
    }
  }
  return { img: { width: w, height: h, data: out }, scale: s };
}

/** Adaptive threshold via an integral image: dark = below local mean − c. */
export function adaptiveThreshold(g: Gray, win: number, c: number): Uint8Array {
  const { width: w, height: h, data } = g;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x]!;
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1]! + row;
    }
  }
  const r = Math.max(1, Math.floor(win / 2));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum =
        integral[y1 * (w + 1) + x1]! -
        integral[y0 * (w + 1) + x1]! -
        integral[y1 * (w + 1) + x0]! +
        integral[y0 * (w + 1) + x0]!;
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * w + x] = data[y * w + x]! < mean - c ? 1 : 0;
    }
  }
  return out;
}

/** Linear contrast stretch between the 2nd and 98th percentile (in place on a copy). */
export function contrastStretch(img: RGBA): RGBA {
  const g = toGray(img);
  const hist = new Uint32Array(256);
  for (const v of g.data) hist[v]!++;
  const total = g.data.length;
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i]!;
    if (acc >= total * 0.02) {
      lo = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i]!;
    if (acc >= total * 0.02) {
      hi = i;
      break;
    }
  }
  const range = Math.max(30, hi - lo);
  const out = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < img.data.length; i += 4) {
    for (let c = 0; c < 3; c++) out[i + c] = ((img.data[i + c]! - lo) * 255) / range;
    out[i + 3] = 255;
  }
  return { width: img.width, height: img.height, data: out };
}

export function rotate180(img: RGBA): RGBA {
  const out = new Uint8ClampedArray(img.data.length);
  const n = img.width * img.height;
  for (let i = 0; i < n; i++) {
    const j = n - 1 - i;
    out[j * 4] = img.data[i * 4]!;
    out[j * 4 + 1] = img.data[i * 4 + 1]!;
    out[j * 4 + 2] = img.data[i * 4 + 2]!;
    out[j * 4 + 3] = img.data[i * 4 + 3]!;
  }
  return { width: img.width, height: img.height, data: out };
}

export function crop(img: RGBA, x: number, y: number, w: number, h: number): RGBA {
  const X = Math.max(0, Math.round(x));
  const Y = Math.max(0, Math.round(y));
  const W = Math.min(img.width - X, Math.round(w));
  const H = Math.min(img.height - Y, Math.round(h));
  const out = new Uint8ClampedArray(W * H * 4);
  for (let yy = 0; yy < H; yy++)
    out.set(
      img.data.subarray(((Y + yy) * img.width + X) * 4, ((Y + yy) * img.width + X + W) * 4),
      yy * W * 4,
    );
  return { width: W, height: H, data: out };
}
