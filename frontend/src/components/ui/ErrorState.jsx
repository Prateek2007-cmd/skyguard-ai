import { TriangleAlert } from "lucide-react";
import Button from "./Button";

/**
 * ErrorState — errors explain what went wrong and how to fix it, in the
 * interface's voice. Never vague, never an apology. Always offers a retry
 * when one can help.
 */
export default function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center px-6 py-10 text-center"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-coral-wash">
        <TriangleAlert className="h-5 w-5 text-coral-deep" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      {message ? (
        <p className="mt-1 max-w-[56ch] text-sm leading-relaxed text-muted">
          {message}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
