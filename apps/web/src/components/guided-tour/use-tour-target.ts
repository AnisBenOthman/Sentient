import { useEffect, useState } from 'react';
import type { TargetRect } from './types';

/** Breathing room drawn around the highlighted element, in px. */
export const SPOTLIGHT_PADDING = 6;

/**
 * How long to keep waiting for a step's target before declaring it missing.
 * Steps that carry a `route` land on a page that fetches before it renders —
 * the profile page shows "Loading..." until its employee query resolves — so
 * the element is routinely absent for the first few hundred milliseconds.
 */
const TARGET_WAIT_MS = 8000;

export type TourTargetStatus = 'pending' | 'found' | 'missing';

export interface TourTarget {
  /** Unpadded viewport rect of the target, or null while it is not on screen. */
  readonly rect: TargetRect | null;
  readonly status: TourTargetStatus;
}

function toRect(el: Element): TargetRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function sameRect(a: TargetRect | null, b: TargetRect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/**
 * WHY: the tour walks across routes, and a step's target only exists once that
 * route has finished loading. Measuring once on mount — what the overlay and
 * the tooltip each used to do on their own — found nothing on those steps and
 * left the four spotlight strips collapsed onto a zero-sized rect, blacking
 * out the whole screen. This waits for the element through a MutationObserver,
 * scrolls it into view once it appears, then keeps its rect current for as
 * long as the step is on screen.
 */
export function useTourTarget(selector: string): TourTarget {
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [status, setStatus] = useState<TourTargetStatus>('pending');

  useEffect(() => {
    let frame = 0;
    let timedOut = false;
    let observed: Element | null = null;
    let scrolled: Element | null = null;

    setRect(null);
    setStatus('pending');

    const resizeObserver = new ResizeObserver(() => schedule());
    const mutationObserver = new MutationObserver(() => schedule());

    function schedule(): void {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }

    function measure(): void {
      const el = document.querySelector(selector);

      if (el !== observed) {
        resizeObserver.disconnect();
        observed = el;
        if (el) resizeObserver.observe(el);
      }

      if (!el) {
        setRect(null);
        setStatus(timedOut ? 'missing' : 'pending');
        return;
      }

      // WHY once per element: re-scrolling on every measure would fight the
      // user the moment they scroll away from the highlight themselves.
      if (scrolled !== el) {
        scrolled = el;
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }

      const next = toRect(el);
      setRect((prev) => (sameRect(prev, next) ? prev : next));
      setStatus('found');
    }

    const giveUp = setTimeout(() => {
      timedOut = true;
      schedule();
    }, TARGET_WAIT_MS);

    measure();
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    // WHY capture: the sidebar and the main pane scroll independently and
    // scroll events do not bubble, so only the capture phase sees them all.
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      clearTimeout(giveUp);
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
    };
  }, [selector]);

  return { rect, status };
}
