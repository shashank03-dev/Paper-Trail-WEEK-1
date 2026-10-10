import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer, Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Paper Trail — your phone stays home",
  description:
    "An open model folds your real neighborhood into a one-sheet paper zine. Print it, leave your phone, walk. Gemma reads your pencil marks when you're back.",
  icons: { icon: "/icons/3d/footprints.png" },
};

export const viewport: Viewport = { themeColor: "#F4EFE4", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="flex min-h-dvh flex-col">
          <Nav />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
