import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TourStep, TooltipPlacement } from './types';

const PADDING = 6;
const TOOLTIP_GAP = 12; // gap between spotlight border and tooltip

interface Position {
  top: number;
  left: number;
  placement: TooltipPlacement;
}

function computePosition(target: string, preferredPlacement: TooltipPlacement): Position {
  const el = document.querySelector(target);
  if (!el) return { top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 160, placement: 'bottom' };

  const r = el.getBoundingClientRect();
  const spotTop = r.top - PADDING;
  const spotLeft = r.left - PADDING;
  const spotRight = r.right + PADDING;
  const spotBottom = r.bottom + PADDING;

  const tooltipW = 320;
  const tooltipH = 200;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = TOOLTIP_GAP;

  const placements: TooltipPlacement[] = [
    preferredPlacement,
    'right',
    'left',
    'bottom',
    'top',
  ];
  const unique = [...new Set(placements)] as TooltipPlacement[];

  for (const p of unique) {
    if (p === 'right') {
      const left = spotRight + gap;
      const top = r.top + r.height / 2 - tooltipH / 2;
      if (left + tooltipW <= vw && top >= 0 && top + tooltipH <= vh) {
        return { top: Math.max(8, top), left, placement: 'right' };
      }
    }
    if (p === 'left') {
      const left = spotLeft - gap - tooltipW;
      const top = r.top + r.height / 2 - tooltipH / 2;
      if (left >= 0 && top >= 0 && top + tooltipH <= vh) {
        return { top: Math.max(8, top), left, placement: 'left' };
      }
    }
    if (p === 'bottom') {
      const top = spotBottom + gap;
      const left = r.left + r.width / 2 - tooltipW / 2;
      if (top + tooltipH <= vh && left >= 0 && left + tooltipW <= vw) {
        return { top, left: Math.max(8, Math.min(left, vw - tooltipW - 8)), placement: 'bottom' };
      }
    }
    if (p === 'top') {
      const top = spotTop - gap - tooltipH;
      const left = r.left + r.width / 2 - tooltipW / 2;
      if (top >= 0 && left >= 0 && left + tooltipW <= vw) {
        return { top, left: Math.max(8, Math.min(left, vw - tooltipW - 8)), placement: 'top' };
      }
    }
  }

  // Fallback: bottom-center of screen
  return {
    top: Math.min(spotBottom + gap, vh - tooltipH - 8),
    left: Math.max(8, Math.min(r.left + r.width / 2 - tooltipW / 2, vw - tooltipW - 8)),
    placement: 'bottom',
  };
}

interface TourTooltipProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export function TourTooltip({ step, stepIndex, totalSteps, onNext, onPrev, onSkip }: TourTooltipProps): React.ReactElement {
  const [pos, setPos] = useState<Position>({ top: -999, left: -999, placement: step.placement ?? 'bottom' });
  const rafRef = useRef<number>(0);

  const reposition = useCallback((): void => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setPos(computePosition(step.target, step.placement ?? 'right'));
    });
  }, [step.target, step.placement]);

  useEffect(() => {
    reposition();
    window.addEventListener('resize', reposition, { passive: true });
    return () => {
      window.removeEventListener('resize', reposition);
      cancelAnimationFrame(rafRef.current);
    };
  }, [reposition]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div
      role="dialog"
      aria-label={step.title}
      aria-describedby="tour-tooltip-desc"
      className={cn(
        'fixed z-[9999] w-80 rounded-xl border bg-background shadow-2xl',
        'animate-in fade-in-0 zoom-in-95 duration-200',
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4 pb-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            {stepIndex + 1} / {totalSteps}
          </span>
          <h3 className="text-sm font-semibold leading-tight">{step.title}</h3>
        </div>
        <button
          onClick={onSkip}
          className="mt-0.5 flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <p id="tour-tooltip-desc" className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground">
        {step.description}
      </p>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1 pb-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'rounded-full transition-all duration-200',
              i === stepIndex ? 'w-4 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-muted-foreground/30',
            )}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="ghost" size="sm" onClick={onPrev} className="h-7 gap-1 px-2 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext} className="h-7 gap-1 px-3 text-xs">
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
