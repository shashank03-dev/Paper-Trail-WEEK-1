import { endpointLabel, llmConfig } from "@/lib/config";

export const cfg = llmConfig();
export const where = endpointLabel(cfg.baseURL);
/** True when pointed at scripts/mock-llm.ts (port 11435/11436) — results are then NOT model numbers. */
export const isMock = /:1143[5-9]\b/.test(cfg.baseURL) || process.env.EVAL_MOCK === "1";

export function banner(): string {
  return isMock
    ? "> ⚠️ **These numbers come from the mock LLM (`scripts/mock-llm.ts`), not from Gemma.** They only prove the harness runs end to end. Run `pnpm eval:writer` and `pnpm eval:reader` against Ollama to get real numbers.\n"
    : `> Measured against \`${cfg.baseURL}\` (${where}) on ${new Date().toISOString().slice(0, 10)}.\n`;
}

export function barChart(
  title: string,
  rows: { label: string; value: number }[],
  max = 100,
  unit = "%",
): string {
  const W = 640;
  const rowH = 26;
  const left = 230;
  const H = 40 + rows.length * rowH + 10;
  const bars = rows
    .map((r, i) => {
      const y = 36 + i * rowH;
      const w = Math.max(0, ((W - left - 60) * r.value) / max);
      return `<text x="${left - 8}" y="${y + 14}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="12" fill="#1B1B1B">${r.label}</text><rect x="${left}" y="${y}" width="${w.toFixed(1)}" height="18" rx="3" fill="${i % 3 === 2 ? "#1F8A8A" : i % 3 === 1 ? "#FF5C8A" : "#1B1B1B"}"/><text x="${left + w + 6}" y="${y + 14}" font-family="IBM Plex Mono, monospace" font-size="12" fill="#1B1B1B">${r.value.toFixed(1)}${unit}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#F4EFE4"/><text x="16" y="22" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="16" fill="#1B1B1B">${title}</text>${bars}</svg>\n`;
}

export const pct = (a: number, b: number) => (b ? (100 * a) / b : 0);
