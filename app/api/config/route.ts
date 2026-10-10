import { NextResponse } from "next/server";
import { endpointLabel, llmConfig, serverConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** The public bits of server config (never the API key). */
export async function GET(req: Request) {
  const s = serverConfig();
  const l = llmConfig(req.headers);
  return NextResponse.json({
    modelText: l.modelText,
    modelVision: l.modelVision,
    endpoint: s.allowEndpointOverride ? l.baseURL : "",
    endpointLabel: endpointLabel(l.baseURL),
    deviceLabel: s.deviceLabel,
    publicUrl: s.publicUrl,
    repoUrl: s.repoUrl,
    demoMode: s.demoMode,
    allowEndpointOverride: s.allowEndpointOverride,
  });
}
