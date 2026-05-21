import type { RoleTier } from '@/lib/auth';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  readonly id: string;
  readonly target: string; // data-tour="..." attribute selector e.g. '[data-tour="home-nav"]'
  readonly title: string;
  readonly description: string;
  readonly placement?: TooltipPlacement;
  readonly route?: string; // navigate here before showing this step
  readonly tiers: readonly RoleTier[];
}

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface GuidedTourState {
  isActive: boolean;
  currentStepIndex: number;
  steps: TourStep[];
}

export interface GuidedTourActions {
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  restart: () => void;
}

export type GuidedTourContextValue = GuidedTourState & GuidedTourActions;
