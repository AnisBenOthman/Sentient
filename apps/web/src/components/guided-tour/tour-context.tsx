import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import type { JwtPayload } from '@sentient/shared';
import { getRoleTier } from '@/lib/auth';
import { ALL_TOUR_STEPS } from '@/lib/tour/tour-steps';
import type { TourStep, GuidedTourContextValue } from './types';

/**
 * WHY per-step and not a single "done" flag: the old key stored only that the
 * tour had been finished, so every step added afterwards was unreachable —
 * anyone who had already run the tour never saw it again, and Settings (the
 * lone Restart entry point) is HR_ADMIN-only, so most users had no way back in
 * at all. Recording which step ids a user has seen means a newly added step
 * introduces itself as a short tour of just that feature, for everyone.
 */
const SEEN_KEY_PREFIX = 'sentient.guided-tour.seen.v1.';

/** The flag written by the pre-per-step implementation. */
const LEGACY_KEY_PREFIX = 'sentient.guided-tour.v1.';

/**
 * The steps that existed when the legacy flag was the only thing stored. A
 * user carrying `done` has, by definition, seen exactly these — so they are
 * migrated as seen and only genuinely newer steps are shown.
 */
const LEGACY_STEP_IDS: readonly string[] = [
  'home-nav', 'profile-nav', 'leaves-nav', 'org-chart-nav', 'performance-nav',
  'okrs-nav', 'dashboard-nav', 'simulation-nav', 'employees-nav',
  'leave-mgmt-nav', 'positions-nav', 'notifications-bell', 'dark-mode-toggle',
];

function seenKey(userId: string): string {
  return `${SEEN_KEY_PREFIX}${userId}`;
}

function readSeen(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((id): id is string => typeof id === 'string'));
      }
    }
    // One-time migration off the legacy boolean.
    if (localStorage.getItem(`${LEGACY_KEY_PREFIX}${userId}`) === 'done') {
      const migrated = new Set(LEGACY_STEP_IDS);
      writeSeen(userId, migrated);
      localStorage.removeItem(`${LEGACY_KEY_PREFIX}${userId}`);
      return migrated;
    }
  } catch {
    // Unreadable or corrupt storage behaves like a first-time user.
  }
  return new Set();
}

function writeSeen(userId: string, ids: Iterable<string>): void {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify([...ids]));
  } catch {
    // ignore storage errors
  }
}

function clearSeen(userId: string): void {
  try {
    localStorage.removeItem(seenKey(userId));
    localStorage.removeItem(`${LEGACY_KEY_PREFIX}${userId}`);
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

  /** Every step this user's role is entitled to, in order. */
  const allSteps: TourStep[] = useMemo(() => {
    if (!user) return [];
    const tier = getRoleTier(user);
    return ALL_TOUR_STEPS.filter((s) => s.tiers.includes(tier));
  }, [user]);

  // The steps of the run currently on screen: unseen-only when the tour opens
  // itself, the full set when the user asks to replay it.
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const navigateToStep = useCallback(
    (step: TourStep | undefined): void => {
      if (step?.route) navigate(step.route);
    },
    [navigate],
  );

  // Auto-start on whatever this user has not been shown yet.
  useEffect(() => {
    if (!user || allSteps.length === 0) return;
    const seen = readSeen(user.sub);
    const unseen = allSteps.filter((s) => !seen.has(s.id));
    if (unseen.length === 0) return;

    // Small delay so the layout mounts and nav items render first.
    const t = setTimeout(() => {
      setSteps(unseen);
      setCurrentStepIndex(0);
      // WHY navigate here and not only on Next: an unseen-only run can start
      // on a step that lives off the current route, such as the profile's
      // Linked Channels tab.
      navigateToStep(unseen[0]);
      setIsActive(true);
    }, 600);
    return () => clearTimeout(t);
  }, [user, allSteps, navigateToStep]);

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

  /** Mark the run that just ended as seen, whether it was finished or skipped. */
  const endRun = useCallback((): void => {
    setIsActive(false);
    if (!user) return;
    const seen = readSeen(user.sub);
    for (const step of steps) seen.add(step.id);
    writeSeen(user.sub, seen);
  }, [user, steps]);

  const start = useCallback((): void => {
    setSteps(allSteps);
    setCurrentStepIndex(0);
    navigateToStep(allSteps[0]);
    setIsActive(true);
  }, [allSteps, navigateToStep]);

  const next = useCallback((): void => {
    setCurrentStepIndex((i) => {
      const next = i + 1;
      if (next >= steps.length) {
        endRun();
        return i;
      }
      navigateToStep(steps[next]);
      return next;
    });
  }, [steps, endRun, navigateToStep]);

  const prev = useCallback((): void => {
    setCurrentStepIndex((i) => {
      const prev = Math.max(0, i - 1);
      navigateToStep(steps[prev]);
      return prev;
    });
  }, [steps, navigateToStep]);

  const skip = useCallback((): void => {
    endRun();
  }, [endRun]);

  const restart = useCallback((): void => {
    if (user) clearSeen(user.sub);
    setSteps(allSteps);
    setCurrentStepIndex(0);
    navigateToStep(allSteps[0]);
    // Small delay for navigation to settle before activating
    setTimeout(() => setIsActive(true), 200);
  }, [user, allSteps, navigateToStep]);

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
