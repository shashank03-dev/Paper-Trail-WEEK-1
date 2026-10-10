/** Server-side configuration from env vars (never sent to the client wholesale). */
export interface LlmConfig {
  baseURL: string;
  apiKey: string;
  modelText: string;
  modelVision: string;
  timeoutMs: number;
  native: boolean;
}

const MODEL_RE = /^[\w.:\-/]{1,64}$/;

export function serverConfig() {
  return {
    demoMode: process.env.DEMO_MODE === "true",
    deviceLabel: (process.env.DEVICE_LABEL ?? "my laptop").slice(0, 40),
    publicUrl: process.env.PUBLIC_URL ?? "",
    repoUrl: process.env.REPO_URL ?? "https://github.com/shashank03-dev/Paper-Trail-WEEK-1",
    nominatimEmail: process.env.NOMINATIM_EMAIL ?? "",
    overpassUrl: process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter",
    allowEndpointOverride: process.env.ALLOW_ENDPOINT_OVERRIDE === "true",
  };
}

/** LLM config, optionally overridden per request by the Settings page (models always; endpoint only if allowed). */
export function llmConfig(headers?: Headers): LlmConfig {
  const base: LlmConfig = {
    baseURL: process.env.LLM_BASE_URL ?? "http://localhost:11434/v1",
    apiKey: process.env.LLM_API_KEY ?? "ollama",
    modelText: process.env.LLM_MODEL_TEXT ?? "gemma4:e4b",
    modelVision: process.env.LLM_MODEL_VISION ?? process.env.LLM_MODEL_TEXT ?? "gemma4:e4b",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 120000),
    native: process.env.LLM_OLLAMA_NATIVE === "true",
  };
  if (!headers) return base;
  const mt = headers.get("x-pt-model-text");
  const mv = headers.get("x-pt-model-vision");
  if (mt && MODEL_RE.test(mt)) base.modelText = mt;
  if (mv && MODEL_RE.test(mv)) base.modelVision = mv;
  const ep = headers.get("x-pt-llm-base");
  if (
    ep &&
    serverConfig().allowEndpointOverride &&
    /^https?:\/\/[\w.\-:[\]]+(\/[\w.\-/]*)?$/.test(ep)
  )
    base.baseURL = ep;
  return base;
}

/** "local" when the endpoint is on this machine / network, for honest UI labels. */
export function endpointLabel(baseURL: string): string {
  try {
    const h = new URL(baseURL).hostname;
    if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(h)) return "local";
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || !h.includes("."))
      return "private network";
    return h;
  } catch {
    return "unknown";
  }
}
