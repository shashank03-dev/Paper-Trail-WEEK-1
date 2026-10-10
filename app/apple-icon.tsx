import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the sheet with its trail, as in the favicon, at 180 px. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#151412",
      }}
    >
      <svg width="150" height="150" viewBox="0 0 32 32" fill="none">
        <rect x="5" y="8.5" width="22" height="15" rx="1.4" fill="#FBFAF6" />
        <path d="M10.5 16h11" stroke="#151412" strokeWidth="1.1" strokeDasharray="1.4 1.1" />
        <path
          d="M8.6 19.6c1.3-5.6 4.4-8.3 8.2-7.7 3.2.5 3.6 3.5 6.1 3.4 1.3 0 1.9-.9 2.1-1.8"
          stroke="#2B3DD8"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="8.6" cy="19.6" r="1.9" fill="#2B3DD8" stroke="#FBFAF6" strokeWidth=".9" />
      </svg>
    </div>,
    size,
  );
}
