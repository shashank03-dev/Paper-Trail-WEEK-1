import type { MetadataRoute } from "next";

const SITE = process.env.PUBLIC_URL || "https://paper-trail-t6mp.onrender.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/new", "/why-open", "/fold-test", "/privacy", "/terms"].map((p) => ({
    url: `${SITE}${p}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.6,
  }));
}
