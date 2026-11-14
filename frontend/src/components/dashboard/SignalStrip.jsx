/**
 * SignalStrip — SkyGuard's signature element: the live telemetry trace.
 * A thin ink instrument line drawn from REAL observations, with coral flags
 * where the pipeline flagged an anomaly. Used in the landing hero and as
 * mini strips on station cards.
 *
 * points: [{ value: number, anomaly?: boolean }]
 * The trace is pure SVG (viewBox 600×H, non-scaling stroke) so it stays
 * crisp at any width. No data → the parent renders a loading/empty state,
 * never a hardcoded fake trace.
 */
export default function SignalStrip({
  points,
  height = 120,
  label = "Telemetry trace",
  className = "",
  flagRadius = 3.5,
}) {
  const width = 600;
  const padX = 4;
  const padY = 10;

  if (!points || points.length < 2) return null;

  const values = points.map((p) => p.value).filter((v) => Number.isFinite(v));
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i) => padX + (i / (points.length - 1)) * (width - padX * 2);
  const y = (v) =>
    padY + (1 - (v - min) / span) * (height - padY * 2);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");

  const anomalies = points
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.anomaly);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
      style={{ width: "100%", height }}
    >
      {/* baseline grid: faint horizontal rules at min/mid/max */}
      {[min, (min + max) / 2, max].map((v, i) => (
        <line
          key={i}
          x1={padX}
          x2={width - padX}
          y1={y(v)}
          y2={y(v)}
          stroke="#101d2b"
          strokeOpacity={i === 1 ? 0.08 : 0.05}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path
        d={path}
        fill="none"
        stroke="#101d2b"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {anomalies.map((p) => (
        <g key={p.i}>
          <line
            x1={x(p.i)}
            x2={x(p.i)}
            y1={y(p.value) - 10}
            y2={y(p.value)}
            stroke="#e87565"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={x(p.i)}
            cy={y(p.value)}
            r={flagRadius}
            fill="#e87565"
            stroke="#ffffff"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      {/* end point: where the trace is now */}
      <circle
        cx={x(points.length - 1)}
        cy={y(points[points.length - 1].value)}
        r={3}
        fill="#267da8"
        stroke="#ffffff"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
