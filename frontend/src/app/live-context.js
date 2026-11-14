import { createContext, useContext } from "react";

/** Live data context — created here so LiveProvider.jsx exports only the component. */
export const LiveContext = createContext(null);

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used inside <LiveProvider>");
  return ctx;
}
