/**
 * Eyebrow — the small vermilion label above a page or section heading.
 * One of the six sanctioned vermilion spots (60/30/10). Sentence case,
 * never tracked capitals: the dash + colour carry the signal, not the
 * casing. Vermilion-deep is 5.07:1 on mist, so the 13px label passes AA.
 */
export default function Eyebrow({ children, className = "" }) {
  return (
    <p
      className={`flex items-center gap-2 text-[13px] font-semibold leading-none text-vermilion-deep ${className}`}
    >
      <span aria-hidden className="h-[2px] w-5 shrink-0 rounded-full bg-vermilion" />
      {children}
    </p>
  );
}
