/**
 * Card — the one surface primitive. Borders-first depth: a 1px low-opacity
 * border on white, radius from the 8/12/16 scale. No card-in-card: inner
 * grouping uses hairline dividers, not nested Cards.
 *
 * variant="glass" renders the frosted surface (.glass in index.css) for
 * overview cards, shells and overlays. variant="glass-subtle" is the
 * quieter frost for dense views (map panel, activity feed). Dense data
 * surfaces (charts, tables, alert detail, simulation forms) keep the
 * solid default — glass never sits behind small text. interactive adds
 * the hover lift + glow (pointer-gated, transform/shadow only).
 */
export default function Card({
  children,
  className = "",
  padding = "p-5",
  radius = "rounded-2xl",
  variant = "solid",
  interactive = false,
  as: Tag = "div",
  ...props
}) {
  const surface =
    variant === "glass"
      ? "glass"
      : variant === "glass-subtle"
        ? "glass-subtle"
        : "border border-line bg-white";
  const lift = interactive ? "glass-hover" : "";
  return (
    <Tag
      className={`${surface} ${radius} ${padding} ${lift} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** Section heading inside a card: title + optional action on one row. */
export function CardHeader({ title, description, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-snug text-ink">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
