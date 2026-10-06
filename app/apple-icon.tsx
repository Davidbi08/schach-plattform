import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#050505" }}>
        <div style={{ width: "90%", height: "90%", position: "relative", display: "flex", overflow: "hidden", borderRadius: "22%", backgroundColor: "#050505" }}>
          <svg width="100%" height="100%" viewBox="0 0 512 512" style={{ position: "absolute", inset: 0 }}>
            <circle cx="150" cy="115" r="16" fill="#fff" />
            <path d="M150 135c-24 20-42 45-42 72 0 22 10 38 24 51h-12c-10 0-16 7-16 15s6 15 16 15h60c10 0 16-7 16-15s-6-15-16-15h-12c14-13 24-29 24-51 0-27-18-52-42-72z" fill="#fff" />
            <path d="M102 295h96l10 18H92zM86 322h128l10 22H76z" fill="#fff" />
            <path d="M316 372c-6-38-2-72 17-102 13-20 29-34 48-47 15-10 23-23 23-39 0-9-3-18-8-27 23 7 42 21 53 41 10 18 13 38 11 57-2 17-8 32-19 45 21 11 37 27 47 47 8 16 11 33 10 50 0 11-8 19-20 19H316z" fill="#fff" />
            <path d="M307 390h134l13 24H294zM292 428h168l13 25H279z" fill="#fff" />
            <path d="M304 72 196 250h63l-82 190 181-224h-66z" fill="#d4af37" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
