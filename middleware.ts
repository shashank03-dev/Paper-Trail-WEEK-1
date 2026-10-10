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
  if (process.env.RATE_LIMIT === "off") return NextResponse.next();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const path = req.nextUrl.pathname;
  const heavy = /^\/api\/(trail|read)/.test(path);
  const ok = heavy ? take(`h:${ip}`, 40, 20) : take(`l:${ip}`, 120, 60);
  if (!ok)
    return NextResponse.json(
      { error: "Too many requests. Take a short walk and try again." },
      { status: 429, headers: { "retry-after": "30" } },
    );
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
