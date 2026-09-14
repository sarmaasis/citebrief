/** Lightweight SVG sparkline — no chart library required. */
export function Sparkline({
  values,
  className,
  width = 64,
  height = 20,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <span className="text-xs text-cb-muted">—</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 1;
  const innerH = height - pad * 2;
  const step = (width - pad * 2) / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = pad + index * step;
      const y = pad + innerH - ((value - min) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const rising = last >= first;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={rising ? "currentColor" : "#737373"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
        className={rising ? "text-cb-accent" : undefined}
      />
    </svg>
  );
}
