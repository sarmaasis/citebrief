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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0B3D2E",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                width: 18,
                height: 22,
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#FAFAF8",
                borderRadius: 2,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 6,
                  height: 6,
                  backgroundColor: "#C5D4CE",
                }}
              />
              <div
                style={{
                  marginTop: 9,
                  marginLeft: 3,
                  width: 12,
                  height: 2,
                  backgroundColor: "#0B3D2E",
                  borderRadius: 1,
                }}
              />
              <div
                style={{
                  marginTop: 2,
                  marginLeft: 3,
                  width: 8,
                  height: 2,
                  backgroundColor: "#0B3D2E",
                  opacity: 0.45,
                  borderRadius: 1,
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: "#0B3D2E", letterSpacing: -0.4 }}>
            CiteBrief
          </div>
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
