export type ContentPart =
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  /** JSON schema for structured output. */
  schema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  ms: number;
  completionTokens?: number;
  /** Which provider answered, when it came through a provider chain. */
  provider?: string;
}

export interface ChatOptions {
  /** Called with each streamed text delta (enables streaming). */
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

/** Anything that can answer a chat request: the real endpoint, the mock, a replay. */
export type Chat = (req: ChatRequest, opts?: ChatOptions) => Promise<ChatResult>;
