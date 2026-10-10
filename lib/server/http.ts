import { NextResponse } from "next/server";
import type { z } from "zod";
import { BusyError } from "./gate";
import { logLine, requestId, type LogFields } from "./observe";

/** Machine-readable error codes; `error` stays a human sentence the UI can show as is. */
export type ErrorCode =
  | "invalid_request"
  | "not_found"
  | "too_large"
  | "forbidden"
  | "rate_limited"
  | "upstream_unavailable"
  | "busy"
  | "internal";

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: "invalid_request",
  403: "forbidden",
  404: "not_found",
  413: "too_large",
  429: "rate_limited",
  502: "upstream_unavailable",
  503: "busy",
};

/** The one error shape every route returns: `{ error, code, details? }`. */
export function jsonError(
  status: number,
  error: string,
  details?: unknown,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error, code: CODE_BY_STATUS[status] ?? "internal", ...(details ? { details } : {}) },
    { status, headers },
  );
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

/** Per-request context handed to every route handler. */
export interface RouteCtx {
  rid: string;
  /** Aborts when the client goes away, so abandoned requests stop spending tokens. */
  signal: AbortSignal;
  /** Add fields to this request's log line. */
  note: (fields: LogFields) => void;
}

/**
 * Wraps a route handler with a request ID, one structured log line, and a safe
 * error boundary: a busy model gate becomes 503 + Retry-After, anything
 * unexpected becomes a 500 with the request ID instead of a stack trace.
 */
export function route(
  name: string,
  handler: (req: Request, ctx: RouteCtx) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const rid = requestId(req);
    const t0 = Date.now();
    const fields: LogFields = {};
    const ctx: RouteCtx = { rid, signal: req.signal, note: (f) => Object.assign(fields, f) };
    let res: Response;
    try {
      res = await handler(req, ctx);
    } catch (e) {
      if (e instanceof BusyError)
        res = jsonError(503, e.message, undefined, { "retry-after": String(e.retryAfterS) });
      else {
        fields.err = String((e as Error)?.message ?? e).slice(0, 160);
        res = jsonError(500, `Something went wrong on our side (request ${rid}).`);
      }
    }
    res.headers.set("x-request-id", rid);
    // Streaming routes log again when the stream ends (see `sse`).
    logLine({ rid, route: name, status: res.status, ms: Date.now() - t0, ...fields });
    return res;
  };
}

/**
 * A text/event-stream response driven by an async producer. Sends a comment
 * heartbeat every 15 s so proxies keep long generations open, and aborts the
 * producer's signal when the client disconnects.
 */
export function sse(
  producer: (send: (event: Record<string, unknown>) => void, signal: AbortSignal) => Promise<void>,
  opts: { rid?: string; route?: string; parent?: AbortSignal; note?: () => LogFields } = {},
): Response {
  const enc = new TextEncoder();
  const ac = new AbortController();
  opts.parent?.addEventListener("abort", () => ac.abort());
  let closed = false;
  let beat: ReturnType<typeof setInterval> | undefined;
  const t0 = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (s: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          closed = true;
        }
      };
      const send = (e: Record<string, unknown>) => write(`data: ${JSON.stringify(e)}\n\n`);
      beat = setInterval(() => write(": ping\n\n"), 15_000);
      let outcome = "ok";
      let err: string | undefined;
      try {
        await producer(send, ac.signal);
      } catch (e) {
        outcome = ac.signal.aborted ? "client-gone" : "error";
        err = String((e as Error)?.message ?? e).slice(0, 160);
        // The client gets a plain sentence; the real error stays in the server log.
        send(
          e instanceof BusyError
            ? { type: "error", error: e.message, code: "busy" }
            : {
                type: "error",
                error: `Something went wrong on our side${opts.rid ? ` (request ${opts.rid})` : ""}. Please try again.`,
                code: "internal",
              },
        );
      } finally {
        clearInterval(beat);
        if (!closed) {
          closed = true;
          controller.close();
        }
        if (opts.rid)
          logLine({
            rid: opts.rid,
            route: opts.route,
            stream: outcome,
            ms: Date.now() - t0,
            err,
            ...opts.note?.(),
          });
      }
    },
    cancel() {
      closed = true;
      clearInterval(beat);
      ac.abort();
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
