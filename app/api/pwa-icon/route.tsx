import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const size = Number(new URL(request.url).searchParams.get("size"));
  if (size !== 192 && size !== 512) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#020617",
        }}
      >
        <div
          style={{
            width: "90%",
            height: "90%",
            position: "relative",
            display: "flex",
            borderRadius: "22%",
            backgroundColor: "#0f172a",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "2%",
              top: "2%",
              width: "58%",
              height: "58%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f8fafc",
              fontFamily: "serif",
              fontSize: size * 0.48,
              lineHeight: 1,
            }}
          >
            ♝
          </div>
          <div
            style={{
              position: "absolute",
              right: "2%",
              bottom: "1%",
              width: "60%",
              height: "60%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#cbd5e1",
              fontFamily: "serif",
              fontSize: size * 0.54,
              lineHeight: 1,
            }}
          >
            ♞
          </div>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
