import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer, Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Paper Trail: the walk app that stays home",
  description:
    "Paper Trail folds the streets around you into an eight-page paper zine. Print it, leave your phone, go. When you're back, one photo and Gemma reads your pencil.",
  icons: { icon: "/icon.svg" },
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
      </body>
    </html>
  );
}
