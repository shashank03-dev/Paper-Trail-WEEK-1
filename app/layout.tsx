import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer, Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Paper Trail — leave your phone at home",
  description:
    "Paper Trail turns the streets around you into a printable 8-page walk. Print it, go outside, and snap one photo when you're back.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0A0A08",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
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
