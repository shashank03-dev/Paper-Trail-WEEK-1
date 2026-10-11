import type { Metadata } from "next";

export const metadata: Metadata = { title: "Make a trail", alternates: { canonical: "/new" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
