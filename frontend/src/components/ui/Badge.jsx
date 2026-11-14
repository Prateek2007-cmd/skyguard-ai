/**
 * Badge — small status/label chip. Sentence case, never tracked capitals,
 * no decorative dots. Tone carries the meaning: coral only for anomalies
 * and alerts, green for healthy, instrument blue for information.
 */
const tones = {
  neutral: "bg-mist text-ink-soft border-line",
  info: "bg-instrument-wash text-instrument-deep border-instrument/20",
  healthy: "bg-healthy-wash text-healthy-deep border-healthy/25",
  alert: "bg-coral-wash text-coral-deep border-coral/30",
  ink: "bg-ink text-white border-ink",
};

export default function Badge({ tone = "neutral", className = "", children, ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 ${tones[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
