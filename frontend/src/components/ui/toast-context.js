import { createContext, useContext } from "react";

/** Toast context — created here so Toast.jsx exports only the component. */
export const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
