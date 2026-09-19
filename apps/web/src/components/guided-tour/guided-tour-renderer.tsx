import { useGuidedTour } from './tour-context';
import { SpotlightOverlay } from './spotlight-overlay';
import { TourTooltip } from './tour-tooltip';
import { useTourTarget } from './use-tour-target';
import type { TourStep } from './types';

export function GuidedTourRenderer(): React.ReactElement | null {
  const { isActive, currentStepIndex, steps, next, prev, skip } = useGuidedTour();

  if (!isActive || steps.length === 0) return null;

  const step = steps[currentStepIndex];
  if (!step) return null;

  return (
    <ActiveTourStep
      step={step}
      stepIndex={currentStepIndex}
      totalSteps={steps.length}
      onNext={next}
      onPrev={prev}
      onSkip={skip}
    />
  );
}

interface ActiveTourStepProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

/**
 * WHY a separate component: the target is measured once, here, and handed to
 * both the overlay and the tooltip. Measuring in each of them meant two
 * MutationObservers racing and two competing scroll-into-view calls.
 */
function ActiveTourStep({ step, stepIndex, totalSteps, onNext, onPrev, onSkip }: ActiveTourStepProps): React.ReactElement {
  const { rect } = useTourTarget(step.target);

  return (
    <>
      <SpotlightOverlay rect={rect} onClickOutside={onSkip} />
      <TourTooltip
        step={step}
        rect={rect}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
      />
    </>
  );
}
