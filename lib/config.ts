/**
 * Server-side configuration from env vars (never sent to the client wholesale).
 *
 * Paper Trail talks to Gemma through one of these providers:
 *   ollama        local Ollama (default)           http://localhost:11434/v1
 *   ollama-cloud  Ollama's hosted API (OLLAMA_API_KEY)  https://ollama.com/v1
 *   gemini        Google's Gemini API, serving Gemma (GEMINI_API_KEY)
 *   openai-compat any other OpenAI-compatible endpoint (LLM_BASE_URL)
 * LLM_PROVIDER may be a comma-separated chain: the next one is tried when one fails.
 */
export type ProviderId = "ollama" | "ollama-cloud" | "gemini" | "openai-compat";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  baseURL: string;
  apiKey: string;
  modelText: string;
  modelVision: string;
  /** Send `response_format: json_schema`; otherwise the schema goes in the prompt. */
  jsonSchema: boolean;
  /** Supports a separate system message; otherwise it's folded into the user turn. */
  systemRole: boolean;
  /** Use Ollama's native /api/chat with `format` instead of /v1 (local Ollama only). */
  native: boolean;
  hosted: boolean;
}

export interface LlmConfig {
  providers: ProviderConfig[];
  /** The primary provider's values, for labels and callers that need one model name. */
  baseURL: string;
  modelText: string;
  modelVision: string;
  timeoutMs: number;
}

const MODEL_RE = /^[\w.:\-/]{1,64}$/;
const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};
const bool = (k: string) => (env(k) === undefined ? undefined : env(k) === "true");

const DEFAULTS: Record<
  ProviderId,
  Omit<ProviderConfig, "apiKey"> & { keyEnv: string; prefix: string }
> = {
  ollama: {
    id: "ollama",
    label: "your machine",
    baseURL: "http://localhost:11434/v1",
    keyEnv: "LLM_API_KEY",
    prefix: "OLLAMA_LOCAL",
    modelText: "gemma4:e4b",
    modelVision: "gemma4:e4b",
    jsonSchema: true,
    systemRole: true,
    native: false,
    hosted: false,
  },
  "ollama-cloud": {
    id: "ollama-cloud",
    label: "Ollama Cloud",
    baseURL: "https://ollama.com/v1",
    keyEnv: "OLLAMA_API_KEY",
    prefix: "OLLAMA_CLOUD",
    modelText: "gemma4:31b",
    modelVision: "gemma4:31b",
    jsonSchema: true,
    systemRole: true,
    native: false,
    hosted: true,
  },
  gemini: {
    id: "gemini",
    label: "the Gemini API",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    keyEnv: "GEMINI_API_KEY",
    prefix: "GEMINI",
    // Gemma 4 served by Google: still an open-weights model.
    modelText: "gemma-4-26b-a4b-it",
    modelVision: "gemma-4-26b-a4b-it",
    jsonSchema: false,
    systemRole: false,
    native: false,
    hosted: true,
  },
  "openai-compat": {
    id: "openai-compat",
    label: "a custom endpoint",
    baseURL: "http://localhost:8000/v1",
    keyEnv: "LLM_API_KEY",
    prefix: "OPENAI_COMPAT",
    modelText: "gemma4:e4b",
    modelVision: "gemma4:e4b",
    jsonSchema: true,
    systemRole: true,
    native: false,
    hosted: true,
  },
};

export function providerIds(): ProviderId[] {
  const raw = env("LLM_PROVIDER");
  if (raw) {
    const ids = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is ProviderId => s in DEFAULTS);
    if (ids.length) return [...new Set(ids)];
  }
  // Auto: whatever keys are present, hosted first; local Ollama otherwise.
  const auto: ProviderId[] = [];
  if (env("GEMINI_API_KEY")) auto.push("gemini");
  if (env("OLLAMA_API_KEY")) auto.push("ollama-cloud");
  return auto.length ? auto : ["ollama"];
}

function resolve(id: ProviderId, primary: boolean, single: boolean): ProviderConfig {
  const d = DEFAULTS[id];
  // The generic LLM_* vars configure the primary provider (and keep old setups working).
  const generic = primary || single;
  const baseURL =
    env(`${d.prefix}_BASE_URL`) ?? (generic ? env("LLM_BASE_URL") : undefined) ?? d.baseURL;
  const local =
    /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\]|[\w-]+:\d+)/.test(baseURL) &&
    !/ollama\.com|googleapis/.test(baseURL);
  return {
    id,
    label: d.label,
    baseURL,
    apiKey: env(d.keyEnv) ?? env("LLM_API_KEY") ?? (id === "ollama" ? "ollama" : ""),
    modelText:
      env(`${d.prefix}_MODEL_TEXT`) ?? (generic ? env("LLM_MODEL_TEXT") : undefined) ?? d.modelText,
    modelVision:
      env(`${d.prefix}_MODEL_VISION`) ??
      (generic ? (env("LLM_MODEL_VISION") ?? env("LLM_MODEL_TEXT")) : undefined) ??
      d.modelVision,
    jsonSchema:
      bool(`${d.prefix}_JSON_SCHEMA`) ??
      (generic ? bool("LLM_JSON_SCHEMA") : undefined) ??
      d.jsonSchema,
    systemRole:
      bool(`${d.prefix}_SYSTEM_ROLE`) ??
      (generic ? bool("LLM_SYSTEM_ROLE") : undefined) ??
      d.systemRole,
    native: id === "ollama" && env("LLM_OLLAMA_NATIVE") === "true",
    hosted: id === "ollama" ? !local : d.hosted,
  };
}

export function serverConfig() {
  return {
    demoMode: env("DEMO_MODE") === "true",
    deviceLabel: (env("DEVICE_LABEL") ?? "my laptop").slice(0, 40),
    publicUrl: env("PUBLIC_URL") ?? "",
    repoUrl: env("REPO_URL") ?? "https://github.com/shashank03-dev/Paper-Trail-WEEK-1",
    nominatimEmail: env("NOMINATIM_EMAIL") ?? "",
    overpassUrl: env("OVERPASS_URL") ?? "https://overpass-api.de/api/interpreter",
    allowEndpointOverride: env("ALLOW_ENDPOINT_OVERRIDE") === "true",
  };
}

/** LLM config, optionally overridden per request by the Settings page (models always; endpoint only if allowed). */
export function llmConfig(headers?: Headers): LlmConfig {
  const ids = providerIds();
  const providers = ids.map((id, i) => resolve(id, i === 0, ids.length === 1));
  const primary = providers[0]!;
  if (headers) {
    const mt = headers.get("x-pt-model-text");
    const mv = headers.get("x-pt-model-vision");
    if (mt && MODEL_RE.test(mt)) primary.modelText = mt;
    if (mv && MODEL_RE.test(mv)) primary.modelVision = mv;
    const ep = headers.get("x-pt-llm-base");
    if (
      ep &&
      serverConfig().allowEndpointOverride &&
      /^https?:\/\/[\w.\-:[\]]+(\/[\w.\-/]*)?$/.test(ep)
    )
      primary.baseURL = ep;
  }
  return {
    providers,
    baseURL: primary.baseURL,
    modelText: primary.modelText,
    modelVision: primary.modelVision,
    timeoutMs: Number(env("LLM_TIMEOUT_MS") ?? 120000),
  };
}

/** Where the model runs, in words for the UI ("your machine", "the Gemini API", …). */
export function endpointLabel(baseURL: string): string {
  try {
    const h = new URL(baseURL).hostname;
    if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(h)) return "local";
    if (h.endsWith("googleapis.com")) return "the Gemini API";
    if (h === "ollama.com" || h.endsWith(".ollama.com")) return "Ollama Cloud";
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || !h.includes("."))
      return "private network";
    return h;
  } catch {
    return "unknown";
  }
}

/** Is the primary model on this machine / network (privacy copy depends on it)? */
export function isHosted(cfg: LlmConfig): boolean {
  return cfg.providers[0]!.hosted;
}
