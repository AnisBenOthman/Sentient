import { useEffect, useRef, useState, useCallback } from 'react';
import type { TargetRect } from './types';

const PADDING = 6; // px padding around the highlighted element

interface SpotlightOverlayProps {
  target: string; // CSS selector for [data-tour="..."]
  onClickOutside: () => void;
}

function emptyRect(): TargetRect {
  return { top: 0, left: 0, width: 0, height: 0 };
}

export function SpotlightOverlay({ target, onClickOutside }: SpotlightOverlayProps): React.ReactElement {
  const [rect, setRect] = useState<TargetRect>(emptyRect);
  const observerRef = useRef<ResizeObserver | null>(null);
  const scrollableRef = useRef<Element | null>(null);

  const measure = useCallback((): void => {
    const el = document.querySelector(target);
    if (!el) {
      setRect(emptyRect());
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
    });
  }, [target]);

  useEffect(() => {
    measure();

    // ResizeObserver on the target element itself
    const el = document.querySelector(target);
    if (el) {
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(el);

      // Observe the nearest scrollable ancestor
      let ancestor = el.parentElement;
      while (ancestor) {
        const overflow = getComputedStyle(ancestor).overflow;
        if (overflow.includes('auto') || overflow.includes('scroll')) {
          scrollableRef.current = ancestor;
          break;
        }
        ancestor = ancestor.parentElement;
      }
    }

    const scrollEl = scrollableRef.current ?? window;
    scrollEl.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });

    return () => {
      observerRef.current?.disconnect();
      scrollEl.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [target, measure]);

  const { top, left, width, height } = rect;
  const right = window.innerWidth - left - width;
  const bottom = window.innerHeight - top - height;

  return (
    <>
      {/* Top strip */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50"
        style={{ bottom: `calc(100vh - ${top}px)` }}
        onClick={onClickOutside}
      />
      {/* Bottom strip */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50"
        style={{ top: `${top + height}px` }}
        onClick={onClickOutside}
      />
      {/* Left strip */}
      <div
        className="fixed z-[9998] bg-black/50"
        style={{ top: `${top}px`, left: 0, width: `${left}px`, height: `${height}px` }}
        onClick={onClickOutside}
      />
      {/* Right strip */}
      <div
        className="fixed z-[9998] bg-black/50"
        style={{ top: `${top}px`, right: 0, width: `${right}px`, height: `${height}px` }}
        onClick={onClickOutside}
      />
      {/* Highlight border ring */}
      <div
        className="fixed z-[9998] rounded-lg pointer-events-none"
        style={{
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`,
          boxShadow: '0 0 0 2px hsl(var(--primary))',
        }}
      />
    </>
  );
}
