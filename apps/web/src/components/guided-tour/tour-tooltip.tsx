import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SPOTLIGHT_PADDING } from './use-tour-target';
import type { TourStep, TooltipPlacement, TargetRect } from './types';

const TOOLTIP_GAP = 12; // gap between spotlight border and tooltip
const TOOLTIP_W = 320;
const TOOLTIP_H = 200;

interface Position {
  top: number;
  left: number;
  placement: TooltipPlacement;
}

function centered(): Position {
  return {
    top: window.innerHeight / 2 - TOOLTIP_H / 2,
    left: window.innerWidth / 2 - TOOLTIP_W / 2,
    placement: 'bottom',
  };
}

function computePosition(rect: TargetRect | null, preferredPlacement: TooltipPlacement): Position {
  if (!rect) return centered();

  const spotTop = rect.top - SPOTLIGHT_PADDING;
  const spotLeft = rect.left - SPOTLIGHT_PADDING;
  const spotRight = rect.left + rect.width + SPOTLIGHT_PADDING;
  const spotBottom = rect.top + rect.height + SPOTLIGHT_PADDING;

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
      const top = rect.top + rect.height / 2 - TOOLTIP_H / 2;
      if (left + TOOLTIP_W <= vw && top >= 0 && top + TOOLTIP_H <= vh) {
        return { top: Math.max(8, top), left, placement: 'right' };
      }
    }
    if (p === 'left') {
      const left = spotLeft - gap - TOOLTIP_W;
      const top = rect.top + rect.height / 2 - TOOLTIP_H / 2;
      if (left >= 0 && top >= 0 && top + TOOLTIP_H <= vh) {
        return { top: Math.max(8, top), left, placement: 'left' };
      }
    }
    if (p === 'bottom') {
      const top = spotBottom + gap;
      const left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      if (top + TOOLTIP_H <= vh && left >= 0 && left + TOOLTIP_W <= vw) {
        return { top, left: Math.max(8, Math.min(left, vw - TOOLTIP_W - 8)), placement: 'bottom' };
      }
    }
    if (p === 'top') {
      const top = spotTop - gap - TOOLTIP_H;
      const left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      if (top >= 0 && left >= 0 && left + TOOLTIP_W <= vw) {
        return { top, left: Math.max(8, Math.min(left, vw - TOOLTIP_W - 8)), placement: 'top' };
      }
    }
  }

  // Fallback: bottom-center of screen
  return {
    top: Math.min(spotBottom + gap, vh - TOOLTIP_H - 8),
    left: Math.max(8, Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8)),
    placement: 'bottom',
  };
}

interface TourTooltipProps {
  step: TourStep;
  /** Unpadded rect of the step's target, or null while it is off screen. */
  rect: TargetRect | null;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

export function TourTooltip({ step, rect, stepIndex, totalSteps, onNext, onPrev, onSkip }: TourTooltipProps): React.ReactElement {
  const [pos, setPos] = useState<Position>(centered);

  // WHY no listeners here: `rect` already arrives measured and rAF-throttled
  // from useTourTarget, which owns the scroll, resize and mutation watching.
  useEffect(() => {
    setPos(computePosition(rect, step.placement ?? 'right'));
  }, [rect, step.placement]);

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
