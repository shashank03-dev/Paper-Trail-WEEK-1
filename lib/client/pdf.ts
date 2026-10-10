"use client";
import { PDFDocument } from "pdf-lib";
import { svgToCanvas } from "./raster";

const MM_TO_PT = 72 / 25.4;

/** Client-side PDF: the sheet rasterised at 300 dpi on an exact-size page. */
export async function downloadSheetPdf(svg: SVGSVGElement, filename: string) {
  const vb = svg.viewBox.baseVal;
  const canvas = await svgToCanvas(svg, 300 / 25.4);
  const png = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const doc = await PDFDocument.create();
  doc.setTitle("Paper Trail zine");
  doc.setCreator("Paper Trail (open source)");
  const page = doc.addPage([vb.width * MM_TO_PT, vb.height * MM_TO_PT]);
  const img = await doc.embedPng(await png.arrayBuffer());
  page.drawImage(img, { x: 0, y: 0, width: vb.width * MM_TO_PT, height: vb.height * MM_TO_PT });
  const bytes = await doc.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
