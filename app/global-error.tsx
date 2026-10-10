"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/client/report";

/** Last resort when the root layout itself fails: no app CSS, so styles are inline. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => reportError("global", error, error.digest), [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#F1EDE4",
          color: "#151412",
          fontFamily: "Georgia, 'Times New Roman', serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 520 }}>
          <p
            style={{
              font: "12px ui-monospace, monospace",
              letterSpacing: ".06em",
              color: "#67635B",
            }}
          >
            PAPER TRAIL
          </p>
          <h1 style={{ fontSize: 48, lineHeight: 1, fontWeight: 400, margin: "16px 0" }}>
            The whole sheet tore. <em style={{ color: "#2B3DD8" }}>Sorry.</em>
          </h1>
          <p
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 17,
              lineHeight: 1.55,
              color: "#46433D",
            }}
          >
            Something failed before the page could load. It has been reported. Your trails are safe
            in this browser.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "12px 22px",
              borderRadius: 999,
              border: 0,
              background: "#151412",
              color: "#FBFAF6",
              font: "600 15px system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
