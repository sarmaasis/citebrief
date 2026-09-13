import { ImageResponse } from "next/og";

export const alt = "CiteBrief · The Friday PDF your client actually reads";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#FAFAF8",
          color: "#171717",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: "#0B3D2E", letterSpacing: -0.4 }}>
          CiteBrief
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 58,
              lineHeight: 1.08,
              fontFamily: "Georgia, Times New Roman, serif",
              maxWidth: 980,
            }}
          >
            The Friday PDF your client actually reads.
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 26, color: "#737373", maxWidth: 820 }}>
            Weekly AI-search reports agencies send to clients.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 20, color: "#737373" }}>
          ChatGPT · Perplexity · Gemini · AI Overviews
        </div>
      </div>
    ),
    { ...size },
  );
}
