import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The site's own faces for images drawn by next/og (WOFF: Satori doesn't read WOFF2). */
export async function ogFonts() {
  const dir = join(process.cwd(), "lib/og");
  const [serif, serifItalic, mono] = await Promise.all([
    readFile(join(dir, "instrument-serif-400.woff")),
    readFile(join(dir, "instrument-serif-400-italic.woff")),
    readFile(join(dir, "fragment-mono-400.woff")),
  ]);
  return [
    { name: "Instrument Serif", data: serif, style: "normal" as const, weight: 400 as const },
    { name: "Instrument Serif", data: serifItalic, style: "italic" as const, weight: 400 as const },
    { name: "Fragment Mono", data: mono, style: "normal" as const, weight: 400 as const },
  ];
}
