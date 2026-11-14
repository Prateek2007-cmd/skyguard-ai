/**
 * Skeleton — loading placeholder that holds the layout's shape so content
 * doesn't jump when data arrives.
 */
export default function Skeleton({ className = "", ...props }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-ink/8 ${className}`}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={i === lines - 1 ? "h-4 w-2/3" : "h-4 w-full"}
        />
      ))}
    </div>
  );
}
