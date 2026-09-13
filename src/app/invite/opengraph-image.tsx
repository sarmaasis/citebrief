import { ImageResponse } from "next/og";

export const alt = "Workspace invite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function InviteOpenGraphImage() {
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
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0B3D2E",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                width: 28,
                height: 34,
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#FAFAF8",
                borderRadius: 3,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 9,
                  height: 9,
                  backgroundColor: "#C5D4CE",
                }}
              />
              <div
                style={{
                  marginTop: 14,
                  marginLeft: 5,
                  width: 18,
                  height: 3,
                  backgroundColor: "#0B3D2E",
                  borderRadius: 2,
                }}
              />
              <div
                style={{
                  marginTop: 4,
                  marginLeft: 5,
                  width: 12,
                  height: 3,
                  backgroundColor: "#0B3D2E",
                  opacity: 0.45,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 48,
              fontFamily: "Georgia, Times New Roman, serif",
            }}
          >
            Workspace invite
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
