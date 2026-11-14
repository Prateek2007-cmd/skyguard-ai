import { useEffect, useRef, useState } from "react";

/**
 * useAnimatedNumber — tweens a displayed number toward its target over
 * ~280ms with an ease-out cubic, so a metric that changes on a poll
 * glides instead of teleporting. Interruption retargets from the
 * currently displayed value, never from the stale target.
 *
 * First render shows the value as-is (no count-up on mount — the number
 * is data, not a celebration). prefers-reduced-motion jumps instantly.
 */
export default function useAnimatedNumber(value) {
  const [display, setDisplay] = useState(value);
  const latestRef = useRef(value);

  useEffect(() => {
    const from = latestRef.current;
    if (from === value) return undefined;

    // Reduced motion: duration 0 still goes through one rAF tick, so the
    // update is async (no synchronous setState in the effect) and the
    // value jumps instantly.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 280;

    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (value - from) * eased;
      latestRef.current = current;
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return display;
}
