import Button from "./Button";

/**
 * EmptyState — an empty view is an invitation to act, not a dead end.
 * Plain explanation of why it's empty, plus the one action that fills it.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mist">
          <Icon className="h-5 w-5 text-muted" aria-hidden />
        </span>
      ) : null}
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
