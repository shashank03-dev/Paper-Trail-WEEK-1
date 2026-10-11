import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fold test", alternates: { canonical: "/fold-test" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
