import type { RoleTier } from '@/lib/auth';
import type enTour from '@/i18n/locales/en/tour.json';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

/**
 * WHY keyed off the EN locale: a step's id *is* its translation key, so a step
 * with no copy — or a typo in an id — is a `tsc` error instead of a tooltip
 * that renders the raw key to the user. EN/FR parity is enforced separately by
 * the `frResourcesMatchEn` guard in `@/i18n`. `controls` is the tooltip's own
 * chrome in that namespace, not a step.
 */
export type TourStepId = Exclude<keyof typeof enTour, 'controls'>;

/**
 * Interpolation placeholders available to `tour` namespace descriptions.
 *
 * WHY a type alias and not an interface, against the usual house rule:
 * i18next's `t()` options parameter requires an index signature, and TypeScript
 * infers an implicit one for type aliases but never for interfaces. As an
 * interface this fails to typecheck; the alternative is a `Record<string,
 * unknown>` that would drop the placeholder names, or an `any`.
 */
export type TourStepCopyValues = {
  /** `{{botHandle}}` — TELEGRAM_BOT_HANDLE from `@/lib/channels/link-channel-copy`. */
  readonly botHandle?: string;
  /** `{{appName}}` — SLACK_APP_NAME from `@/lib/channels/link-channel-copy`. */
  readonly appName?: string;
};

export interface TourStep {
  /** Also the `tour` namespace key holding this step's title and description. */
  readonly id: TourStepId;
  readonly target: string; // data-tour="..." attribute selector e.g. '[data-tour="home-nav"]'
  readonly placement?: TooltipPlacement;
  readonly route?: string; // navigate here before showing this step
  readonly tiers: readonly RoleTier[];
  /**
   * Values interpolated into the translated description, for copy that must
   * quote something single-sourced in code rather than duplicate it into every
   * locale file. Named explicitly rather than as a Record so the set of
   * placeholders the locale files may use stays visible in one place.
   */
  readonly descriptionValues?: TourStepCopyValues;
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
