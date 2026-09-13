import { ImageResponse } from "next/og";

export const alt = "Client report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Neutral share card. Client links must not unfurl as CiteBrief marketing. */
export default function ClientReportOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAFAF8",
          color: "#171717",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 48,
            fontFamily: "Georgia, Times New Roman, serif",
          }}
        >
          Client report
        </div>
      </div>
    ),
    { ...size },
  );
}
