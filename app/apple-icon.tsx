import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#020617" }}>
        <div style={{ width: "90%", height: "90%", position: "relative", display: "flex", borderRadius: "22%", backgroundColor: "#0f172a" }}>
          <div style={{ position: "absolute", left: "2%", top: "2%", width: "58%", height: "58%", display: "flex", alignItems: "center", justifyContent: "center", color: "#f8fafc", fontFamily: "serif", fontSize: 86, lineHeight: 1 }}>♝</div>
          <div style={{ position: "absolute", right: "2%", bottom: "1%", width: "60%", height: "60%", display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontFamily: "serif", fontSize: 97, lineHeight: 1 }}>♞</div>
        </div>
      </div>
    ),
    size,
  );
}
