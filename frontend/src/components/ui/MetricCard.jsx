import Card from "./Card";
import useAnimatedNumber from "../../hooks/useAnimatedNumber";

/**
 * MetricCard — one number, named plainly. The value leads (size + weight +
 * tabular figures); the label is demoted; a sub-line explains what the
 * number means. Tone only when the value itself is a status — except
 * "accent", the one focal number per view (vermilion, 28px semibold is
 * large text so 3.68:1 passes).
 *
 * Glass surface. Numeric values glide to their new value on change
 * (useAnimatedNumber); non-numeric values crossfade via a keyed span.
 * Neither animates on first mount.
 */
export default function MetricCard({
  label,
  value,
  sub,
  tone = "default",
  icon: Icon,
}) {
  const valueTone =
    tone === "alert"
      ? "text-coral-deep"
      : tone === "healthy"
        ? "text-healthy-deep"
        : tone === "info"
          ? "text-instrument-deep"
          : tone === "accent"
            ? "text-vermilion"
            : "text-ink";
  const parsed = parseMetricValue(value);
  return (
    <Card variant="glass" padding="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-snug text-muted">{label}</p>
        {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden /> : null}
      </div>
      {parsed ? (
        <AnimatedValue parsed={parsed} className={valueTone} />
      ) : (
        <p
          key={String(value)}
          className={`sg-value tnum mt-2 text-[28px] font-semibold leading-none tracking-tight ${valueTone}`}
        >
          {value}
        </p>
      )}
      {sub ? (
        <p className="mt-2 text-[13px] leading-snug text-muted">{sub}</p>
      ) : null}
    </Card>
  );
}

function AnimatedValue({ parsed, className }) {
  const animated = useAnimatedNumber(parsed.num);
  return (
    <p
      className={`tnum mt-2 text-[28px] font-semibold leading-none tracking-tight ${className}`}
    >
      {`${animated.toFixed(parsed.decimals)}${parsed.suffix}`}
    </p>
  );
}

/**
 * Parses the values MetricCard actually receives: a plain number, a
 * numeric string ("95.7"), a percentage ("95.7%"), or a count with a
 * suffix ("3 of 6"). Anything else (relative times, "—") returns null
 * and renders as a keyed fade. Decimals are preserved from the original
 * string. The suffix allowlist is deliberate: a time like "12:30" must
 * never be treated as a tweenable number.
 */
function parseMetricValue(value) {
  const trimmed =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim()
        : null;
  if (trimmed === null) return null;
  const whole = trimmed.match(/^(-?\d+(?:\.(\d+))?)$/);
  if (whole) {
    return {
      num: Number(whole[1]),
      decimals: whole[2] ? whole[2].length : 0,
      suffix: "",
    };
  }
  const percent = trimmed.match(/^(-?\d+(?:\.(\d+))?)%$/);
  if (percent) {
    return {
      num: Number(percent[1]),
      decimals: percent[2] ? percent[2].length : 0,
      suffix: "%",
    };
  }
  const counted = trimmed.match(/^(-?\d+(?:\.(\d+))?)\s+(of\s+\d+)$/);
  if (counted) {
    return {
      num: Number(counted[1]),
      decimals: counted[2] ? counted[2].length : 0,
      suffix: ` ${counted[3]}`,
    };
  }
  return null;
}
