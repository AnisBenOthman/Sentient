import { useEffect, useRef, useState } from "react";

const MIN_DURATION_MS = 400;
const MAX_DURATION_MS = 2200;
const MS_PER_CHAR = 12;

/**
 * Reveals `text` progressively over a length-scaled duration to mimic an LLM
 * typing its answer. Pass `active=false` for text that should render
 * immediately (e.g. history loaded from a past conversation) — only the
 * message that just arrived from the server should animate.
 */
export function useTypewriter(text: string, active: boolean): string {
  const [visibleLength, setVisibleLength] = useState(active ? 0 : text.length);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || text.length === 0) {
      setVisibleLength(text.length);
      return;
    }

    setVisibleLength(0);
    const durationMs = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, text.length * MS_PER_CHAR));
    const startedAt = performance.now();

    function step(now: number): void {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      setVisibleLength(Math.floor(text.length * progress));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    }

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [text, active]);

  return text.slice(0, visibleLength);
}
