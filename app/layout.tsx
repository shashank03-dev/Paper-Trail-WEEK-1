import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer, Nav } from "@/components/Nav";
import { ErrorReporter } from "@/components/ErrorReporter";

/** The public address, for absolute link-preview URLs (set PUBLIC_URL on the host). */
const SITE = process.env.PUBLIC_URL || "https://paper-trail-t6mp.onrender.com";
const DESCRIPTION =
  "Paper Trail folds the streets around you into an eight-page paper zine. Print it, leave your phone, go. When you're back, one photo and Gemma reads your pencil.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Paper Trail: the walk app that stays home",
    template: "%s · Paper Trail",
  },
  description: DESCRIPTION,
  applicationName: "Paper Trail",
  icons: { icon: "/icon.svg" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Paper Trail",
    title: "Paper Trail: the walk app that stays home",
    description: DESCRIPTION,
    url: "/",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paper Trail: the walk app that stays home",
    description:
      "Your streets, folded into an 8-page paper zine by Gemma. Print it. Leave your phone. Go.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#F1EDE4",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="relative">
          {children}
        </main>
        <Footer />
        <ErrorReporter />
      </body>
    </html>
  );
}
