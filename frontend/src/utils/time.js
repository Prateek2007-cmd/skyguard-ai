/**
 * Time helpers. The backend returns ISO timestamps; some carry a UTC offset
 * ("2026-11-14T06:00:00+00:00") and some are naive ("2026-11-14T06:02:00").
 * Naive values are stored UTC, so they are parsed as UTC — parsing them as
 * local time would shift every stored timestamp by the viewer's offset.
 */

export function parseApiTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  // Naive ISO (no Z, no ±hh:mm offset) → treat as UTC.
  const hasOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  const date = new Date(hasOffset ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

/** "14:32" in the viewer's locale. */
export function formatTime(value) {
  const date = parseApiTime(value);
  return date ? timeFmt.format(date) : "—";
}

/** "14 Nov, 14:32" in the viewer's locale. */
export function formatDateTime(value) {
  const date = parseApiTime(value);
  return date ? dateTimeFmt.format(date) : "—";
}

/** "14 Nov" in the viewer's locale. */
export function formatDate(value) {
  const date = parseApiTime(value);
  return date ? dateFmt.format(date) : "—";
}

/**
 * "12 Nov – 14 Nov"; collapses to a single date when both ends fall on
 * the same day. Use where a full timestamp range would wrap awkwardly
 * (hero trace meta). Returns "—" when either end is unparseable.
 */
export function formatDateRange(from, to) {
  const a = formatDate(from);
  const b = formatDate(to);
  if (a === "—" || b === "—") return "—";
  return a === b ? a : `${a} – ${b}`;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function relativeTime(value, now = new Date()) {
  const date = parseApiTime(value);
  if (!date) return "unknown";
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
