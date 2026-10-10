import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paper Trail",
    short_name: "Paper Trail",
    description: "A walk you print at home, written by an open model.",
    start_url: "/",
    display: "standalone",
    background_color: "#F1EDE4",
    theme_color: "#F1EDE4",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
