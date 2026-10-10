"use client";
import type { RGBA } from "@/lib/vision/image";

export async function fileToRGBA(file: Blob, maxSide = 2400): Promise<RGBA> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s);
  const h = Math.round(bmp.height * s);
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: id.data };
}

export function rgbaToCanvas(img: RGBA): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d")!.putImageData(
    new ImageData(new Uint8ClampedArray(img.data), img.width, img.height),
    0,
    0,
  );
  return c;
}

export function rgbaToDataURL(img: RGBA, type = "image/png", quality?: number): string {
  return rgbaToCanvas(img).toDataURL(type, quality);
}

const FONT_FILES = [
  ["Fraunces", 400, "normal", "fraunces-latin-400-normal"],
  ["Fraunces", 600, "normal", "fraunces-latin-600-normal"],
  ["Fraunces", 700, "normal", "fraunces-latin-700-normal"],
  ["Fraunces", 400, "italic", "fraunces-latin-400-italic"],
  ["Inter", 400, "normal", "inter-latin-400-normal"],
  ["Inter", 500, "normal", "inter-latin-500-normal"],
  ["Inter", 600, "normal", "inter-latin-600-normal"],
  ["IBM Plex Mono", 400, "normal", "ibm-plex-mono-latin-400-normal"],
  ["IBM Plex Mono", 500, "normal", "ibm-plex-mono-latin-500-normal"],
] as const;

let fontCss: Promise<string> | null = null;
/** Fonts inlined as data URIs: an SVG drawn into a canvas can't load external fonts. */
function embeddedFonts(): Promise<string> {
  if (!fontCss) {
    fontCss = Promise.all(
      FONT_FILES.map(async ([fam, w, st, file]) => {
        const buf = await (await fetch(`/fonts/${file}.woff2`)).arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000)
          bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `@font-face{font-family:"${fam}";font-weight:${w};font-style:${st};src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2");}`;
      }),
    ).then((a) => a.join(""));
  }
  return fontCss;
}

/** Rasterise the sheet SVG at a print resolution. */
export async function svgToCanvas(svg: SVGSVGElement, pxPerMm: number): Promise<HTMLCanvasElement> {
  const vb = svg.viewBox.baseVal;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = (await embeddedFonts()) + ".sheet-bg{fill:#fff}";
  clone.insertBefore(style, clone.firstChild);
  clone.setAttribute("width", String(Math.round(vb.width * pxPerMm)));
  clone.setAttribute("height", String(Math.round(vb.height * pxPerMm)));
  clone.querySelectorAll(".panel-pending").forEach((n) => n.remove());
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = Math.round(vb.width * pxPerMm);
    c.height = Math.round(vb.height * pxPerMm);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
