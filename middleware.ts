import { NextResponse, type NextRequest } from "next/server";

/**
 * A simple in-memory token bucket per IP for /api/* so a public demo can't be
 * hammered. Heavy model routes get a smaller bucket.
 */
const buckets = new Map<string, { tokens: number; at: number }>();

function take(key: string, capacity: number, refillPerMin: number): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 60_000) * refillPerMin);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value!);
  return true;
}

export function middleware(req: NextRequest) {
  // One ID per request, passed to the route (for its log line) and back to the client.
  const given = req.headers.get("x-request-id");
  const rid = given && /^[\w-]{6,64}$/.test(given) ? given : crypto.randomUUID().slice(0, 12);
  const headers = new Headers(req.headers);
  headers.set("x-request-id", rid);
  // The API is for this site's own pages. Browsers label requests made by
  // another site's scripts as cross-site; those never reach a model call.
  if (req.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json(
      { error: "This API only serves Paper Trail's own pages.", code: "forbidden" },
      { status: 403, headers: { "x-request-id": rid } },
    );
  if (process.env.RATE_LIMIT !== "off") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "local";
    const path = req.nextUrl.pathname;
    const heavy = /^\/api\/(trail|read)/.test(path);
    const ok = heavy ? take(`h:${ip}`, 40, 20) : take(`l:${ip}`, 120, 60);
    if (!ok)
      return NextResponse.json(
        { error: "Too many requests. Take a short walk and try again.", code: "rate_limited" },
        { status: 429, headers: { "retry-after": "30", "x-request-id": rid } },
      );
  }
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", rid);
  return res;
}

export const config = { matcher: "/api/:path*" };
