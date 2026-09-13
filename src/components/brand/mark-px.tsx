/** Satori-safe paper-brief mark for icon.tsx / apple-icon.tsx / OG. */
export function MarkPx({ size, radius }: { size: number; radius: number }) {
  const paperW = Math.round(size * 0.5);
  const paperH = Math.round(size * 0.62);
  const fold = Math.round(size * 0.16);
  const lineH = Math.max(2, Math.round(size * 0.05));
  const pad = Math.round(size * 0.1);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0B3D2E",
        borderRadius: radius,
      }}
    >
      <div
        style={{
          width: paperW,
          height: paperH,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#FAFAF8",
          borderRadius: Math.max(2, Math.round(size * 0.04)),
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: fold,
            height: fold,
            backgroundColor: "#C5D4CE",
          }}
        />
        <div
          style={{
            marginTop: Math.round(size * 0.26),
            marginLeft: pad,
            width: paperW - pad * 2,
            height: lineH,
            backgroundColor: "#0B3D2E",
            borderRadius: lineH,
          }}
        />
        <div
          style={{
            marginTop: Math.round(size * 0.06),
            marginLeft: pad,
            width: Math.round((paperW - pad * 2) * 0.7),
            height: lineH,
            backgroundColor: "#0B3D2E",
            opacity: 0.45,
            borderRadius: lineH,
          }}
        />
      </div>
    </div>
  );
}
