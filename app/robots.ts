import type { MetadataRoute } from "next";

const SITE = process.env.PUBLIC_URL || "https://paper-trail-t6mp.onrender.com";

export default function robots(): MetadataRoute.Robots {
  return {
    // Trails, returns and postcards live in one browser; there's nothing to index there.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/trail/", "/return/", "/postcard/"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
