import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og/fonts";

export const alt =
  "Paper Trail: the walk app that stays home. A folded paper zine and a blue pencil on a desk.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#151412";
const RISO = "#2B3DD8";
const PINK = "#FF5C8A";

/** The link preview, drawn in code like everything else: the cover of a zine, a pencil, the line. */
export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(135deg, #F7F4EC 0%, #F1EDE4 55%, #E8E3D7 100%)",
        color: INK,
        padding: "64px 72px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: "Fragment Mono",
            fontSize: 22,
            letterSpacing: 2,
            color: "#67635B",
          }}
        >
          <div style={{ width: 44, height: 2, background: "#67635B" }} />
          PAPER TRAIL
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 40,
            fontFamily: "Instrument Serif",
            fontSize: 112,
            lineHeight: 0.92,
            letterSpacing: -3,
          }}
        >
          <span>The walk app that</span>
          <span style={{ fontStyle: "italic", color: RISO }}>stays home.</span>
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: "Fragment Mono",
            fontSize: 24,
            lineHeight: 1.45,
            color: "#46433D",
            display: "flex",
          }}
        >
          Your streets, folded into an 8-page paper zine by Gemma. Print it. Leave your phone. Go.
        </div>
      </div>

      {/* The cover of a folded zine, tilted on the desk. */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: 92,
          width: 300,
          height: 452,
          background: "#FFFDF8",
          transform: "rotate(7deg)",
          boxShadow: "0 40px 70px -30px rgba(21,20,18,.45), 0 2px 4px rgba(21,20,18,.12)",
          display: "flex",
          padding: 18,
        }}
      >
        <div
          style={{
            flex: 1,
            border: `3px solid ${INK}`,
            display: "flex",
            flexDirection: "column",
            padding: "20px 18px",
          }}
        >
          <div style={{ fontFamily: "Fragment Mono", fontSize: 13, color: PINK, display: "flex" }}>
            A FIELD GUIDE FOR SAM
          </div>
          <div
            style={{
              fontFamily: "Instrument Serif",
              fontSize: 50,
              lineHeight: 0.95,
              marginTop: 14,
              display: "flex",
            }}
          >
            The Golden Hydrant Loop
          </div>
          <div
            style={{
              fontFamily: "Instrument Serif",
              fontStyle: "italic",
              fontSize: 22,
              marginTop: 14,
              color: "#46433D",
              display: "flex",
            }}
          >
            Six stops around Dolores Park and one pencil
          </div>
          <div
            style={{
              marginTop: "auto",
              alignSelf: "center",
              border: `3px solid ${PINK}`,
              color: PINK,
              fontFamily: "Fragment Mono",
              fontSize: 16,
              padding: "8px 14px",
              transform: "rotate(-6deg)",
              display: "flex",
            }}
          >
            PHONE STAYS HOME
          </div>
        </div>
      </div>

      {/* A riso-blue pencil lying across the corner. */}
      <div
        style={{
          position: "absolute",
          right: 40,
          bottom: 64,
          width: 420,
          height: 22,
          transform: "rotate(-14deg)",
          display: "flex",
          boxShadow: "0 18px 24px -14px rgba(21,20,18,.5)",
        }}
      >
        <div style={{ width: 26, background: "#E9A8A0", borderRadius: "6px 0 0 6px" }} />
        <div style={{ width: 22, background: "#C9C3B4" }} />
        <div style={{ flex: 1, background: RISO }} />
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "11px solid transparent",
            borderBottom: "11px solid transparent",
            borderLeft: "46px solid #E2C294",
          }}
        />
      </div>
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
