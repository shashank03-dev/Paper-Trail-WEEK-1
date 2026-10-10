import type { Weather } from "@/lib/schemas";

/** WMO weather codes (Open-Meteo) → our small set. */
export function codeToCondition(code: number): Weather["condition"] {
  if (code === 0) return "clear";
  if (code <= 2) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}
