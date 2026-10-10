import { z } from "zod";
import { parseBody, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["render", "runtime", "promise", "global"]),
  message: z.string().max(300),
  digest: z.string().max(64).optional(),
  path: z.string().max(200),
});

/**
 * Error tracking without a third party: the browser reports crashes here and
 * they land in the server log next to everything else, tagged `client-error`.
 * Only the message, the error digest and the path (no query string) are kept.
 */
export const POST = route("client-error", async (req, rc) => {
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  rc.note({
    kind: b.data.kind,
    path: b.data.path.split("?")[0],
    digest: b.data.digest,
    message: b.data.message.replace(/\s+/g, " ").slice(0, 300),
  });
  return new Response(null, { status: 204 });
});
