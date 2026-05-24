import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import type { JwtPayload } from '@sentient/shared';
import { getRoleTier } from '@/lib/auth';
import { ALL_TOUR_STEPS } from '@/lib/tour/tour-steps';
import type { TourStep, GuidedTourContextValue } from './types';

const STORAGE_KEY_PREFIX = 'sentient.guided-tour.v1.';

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function hasCompleted(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === 'done';
  } catch {
    return false;
  }
}

function markCompleted(userId: string): void {
  try {
    localStorage.setItem(storageKey(userId), 'done');
  } catch {
    // ignore storage errors
  }
}

function clearCompleted(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore storage errors
  }
}

const GuidedTourContext = createContext<GuidedTourContextValue | null>(null);

interface GuidedTourProviderProps {
  user: JwtPayload | null;
  children: React.ReactNode;
}

export function GuidedTourProvider({ user, children }: GuidedTourProviderProps): React.ReactElement {
  const [, navigate] = useLocation();

  const steps: TourStep[] = useMemo(() => {
    if (!user) return [];
    const tier = getRoleTier(user);
    return ALL_TOUR_STEPS.filter((s) => s.tiers.includes(tier));
  }, [user]);

  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Auto-start for new users
  useEffect(() => {
    if (!user || hasCompleted(user.sub) || steps.length === 0) return;
    // Small delay so the layout mounts and nav items render first
    const t = setTimeout(() => setIsActive(true), 600);
    return () => clearTimeout(t);
  }, [user, steps.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') skip();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStepIndex]);

  const navigateToStep = useCallback(
    (step: TourStep | undefined): void => {
      if (step?.route) navigate(step.route);
    },
    [navigate],
  );

  const start = useCallback((): void => {
    setCurrentStepIndex(0);
    setIsActive(true);
    navigateToStep(steps[0]);
  }, [steps, navigateToStep]);

  const next = useCallback((): void => {
    setCurrentStepIndex((i) => {
      const next = i + 1;
      if (next >= steps.length) {
        setIsActive(false);
        if (user) markCompleted(user.sub);
        return i;
      }
      navigateToStep(steps[next]);
      return next;
    });
  }, [steps, user, navigateToStep]);

  const prev = useCallback((): void => {
    setCurrentStepIndex((i) => {
      const prev = Math.max(0, i - 1);
      navigateToStep(steps[prev]);
      return prev;
    });
  }, [steps, navigateToStep]);

  const skip = useCallback((): void => {
    setIsActive(false);
    if (user) markCompleted(user.sub);
  }, [user]);

  const restart = useCallback((): void => {
    if (user) clearCompleted(user.sub);
    setCurrentStepIndex(0);
    navigateToStep(steps[0]);
    // Small delay for navigation to settle before activating
    setTimeout(() => setIsActive(true), 200);
  }, [user, steps, navigateToStep]);

  const value: GuidedTourContextValue = {
    isActive,
    currentStepIndex,
    steps,
    start,
    next,
    prev,
    skip,
    restart,
  };

  return <GuidedTourContext.Provider value={value}>{children}</GuidedTourContext.Provider>;
}

export function useGuidedTour(): GuidedTourContextValue {
  const ctx = useContext(GuidedTourContext);
  if (!ctx) throw new Error('useGuidedTour must be used inside GuidedTourProvider');
  return ctx;
}
