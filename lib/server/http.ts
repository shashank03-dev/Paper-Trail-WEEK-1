import { NextResponse } from "next/server";
import type { z } from "zod";

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, ...(details ? { details } : {}) }, { status });
}

export const MAX_BODY_BYTES = 8 * 1024 * 1024;

/** Read + validate a JSON body with zod; enforces the 8 MB upload cap. */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES)
    return { ok: false, res: jsonError(413, "Upload too large (max 8 MB).") };
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES)
      return { ok: false, res: jsonError(413, "Upload too large (max 8 MB).") };
    raw = JSON.parse(text);
  } catch {
    return { ok: false, res: jsonError(400, "Body must be JSON.") };
  }
  const r = schema.safeParse(raw);
  if (!r.success)
    return {
      ok: false,
      res: jsonError(
        400,
        "Invalid request.",
        r.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`),
      ),
    };
  return { ok: true, data: r.data };
}

/** A text/event-stream response driven by an async producer. */
export function sse(
  producer: (send: (event: Record<string, unknown>) => void) => Promise<void>,
): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        await producer(send);
      } catch (e) {
        send({ type: "error", error: (e as Error).message?.slice(0, 200) ?? "failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
