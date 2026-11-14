import { useCallback, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { ToastContext } from "./toast-context";

/**
 * Toast — small confirmations and failure notices. Auto-dismisses after
 * 5s; the viewport is an aria-live region so screen readers hear it.
 * Usage: const { toast } = useToast(); toast("Repaired", {tone: "success"}).
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, { tone = "info", description } = {}) => {
      const id = ++idRef.current;
      setToasts((current) => [...current, { id, message, tone, description }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toneIcon = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
};

const toneColor = {
  success: "text-healthy-deep",
  error: "text-coral-deep",
  info: "text-instrument-deep",
};

function ToastCard({ toast: t, onDismiss }) {
  const Icon = toneIcon[t.tone] || Info;
  return (
    <div
      role={t.tone === "error" ? "alert" : "status"}
      className="glass-strong sg-toast pointer-events-auto flex w-full items-start gap-3 rounded-xl px-4 py-3"
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneColor[t.tone]}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-ink">{t.message}</p>
        {t.description ? (
          <p className="mt-0.5 text-[13px] leading-snug text-muted">
            {t.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded-md p-1 text-muted transition-colors hover:bg-mist hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
