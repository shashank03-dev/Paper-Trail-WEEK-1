"use client";
import type { Paper } from "@/lib/schemas";

export interface ClientSettings {
  endpoint?: string;
  modelText?: string;
  modelVision?: string;
  paper?: Paper;
  sound?: boolean;
}

const KEY = "papertrail.settings";

export function loadSettings(): ClientSettings {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as ClientSettings;
  } catch {
    return {};
  }
}

export function saveSettings(s: ClientSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: settings just won't persist */
  }
}

export function defaultPaper(): Paper {
  const s = loadSettings();
  if (s.paper) return s.paper;
  const lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
  return /^en-(US|CA)|es-(MX|US)|fil|en-PH/i.test(lang) ? "letter" : "a4";
}

/** Headers that let the server use this browser's model choices. */
export function llmHeaders(): Record<string, string> {
  const s = loadSettings();
  const h: Record<string, string> = {};
  if (s.modelText) h["x-pt-model-text"] = s.modelText;
  if (s.modelVision) h["x-pt-model-vision"] = s.modelVision;
  if (s.endpoint) h["x-pt-llm-base"] = s.endpoint;
  return h;
}
