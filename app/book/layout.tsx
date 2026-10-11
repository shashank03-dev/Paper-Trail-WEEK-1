import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trail Book",
  alternates: { canonical: "/book" },
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
