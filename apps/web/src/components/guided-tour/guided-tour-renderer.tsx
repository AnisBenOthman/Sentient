import { useGuidedTour } from './tour-context';
import { SpotlightOverlay } from './spotlight-overlay';
import { TourTooltip } from './tour-tooltip';

export function GuidedTourRenderer(): React.ReactElement | null {
  const { isActive, currentStepIndex, steps, next, prev, skip } = useGuidedTour();

  if (!isActive || steps.length === 0) return null;

  const step = steps[currentStepIndex];
  if (!step) return null;

  return (
    <>
      <SpotlightOverlay target={step.target} onClickOutside={skip} />
      <TourTooltip
        step={step}
        stepIndex={currentStepIndex}
        totalSteps={steps.length}
        onNext={next}
        onPrev={prev}
        onSkip={skip}
      />
    </>
  );
}
