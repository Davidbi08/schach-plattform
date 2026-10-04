import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#020617" }}>
        <div style={{ width: "90%", height: "90%", position: "relative", display: "flex", overflow: "hidden", borderRadius: "22%", backgroundColor: "#0f172a" }}>
          <svg width="100%" height="100%" viewBox="0 0 512 512" style={{ position: "absolute", inset: 0 }}>
            <circle cx="377" cy="373" r="126" fill="#e2e8f0" />
            <circle cx="190" cy="88" r="29" fill="#f8fafc" />
            <path d="M165 121c-9 8-15 18-19 31l-15 48c-4 14-15 24-31 34l12 26c13 10 28 16 45 18l-23 33-14 34h140l-14-34-23-33c17-2 32-8 45-18l12-26c-16-10-27-20-31-34l-15-48c-4-13-10-23-19-31z" fill="#f8fafc" />
            <path d="M176 75l28 28" fill="none" stroke="#0f172a" strokeWidth="8" strokeLinecap="round" />
            <path d="M278 434l29-55-33-39c-14-17-15-38-3-55l17-24 38-27 31 1 22 23 17-20 18 43 31 17 18 29-30 10-30-15-24 10-3 25 36 20 13 39 31 36 2 22H278z" fill="#1e3a8a" />
            <circle cx="407" cy="313" r="6" fill="#f8fafc" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
