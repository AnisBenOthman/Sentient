import type { TourStep } from '@/components/guided-tour/types';
import { SLACK_APP_NAME, TELEGRAM_BOT_HANDLE } from '@/lib/channels/link-channel-copy';

/**
 * WHY the query string: the Linked Channels steps need the profile page to
 * open on that tab, and EmployeeProfile reads its active tab from `?tab=`.
 */
const LINKED_CHANNELS_ROUTE = '/profile?tab=channels';

/**
 * Step order, targets and audience. The copy lives in the `tour` i18n
 * namespace (`src/i18n/locales/{en,fr}/tour.json`) keyed by `id`, so the tour
 * speaks whichever language the rest of the app is in.
 */
export const ALL_TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'home-nav',
    target: '[data-tour="home-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
  },
  {
    id: 'profile-nav',
    target: '[data-tour="profile-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
  },
  {
    id: 'leaves-nav',
    target: '[data-tour="leaves-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
  },
  {
    id: 'org-chart-nav',
    target: '[data-tour="org-chart-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
  },
  {
    id: 'performance-nav',
    target: '[data-tour="performance-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
  },
  {
    id: 'okrs-nav',
    target: '[data-tour="okrs-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
  },
  {
    id: 'dashboard-nav',
    target: '[data-tour="dashboard-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin', 'dept_manager', 'team_lead'],
  },
  {
    id: 'simulation-nav',
    target: '[data-tour="simulation-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin', 'dept_manager', 'team_lead'],
  },
  {
    id: 'employees-nav',
    target: '[data-tour="employees-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin'],
  },
  {
    id: 'leave-mgmt-nav',
    target: '[data-tour="leave-mgmt-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin'],
  },
  {
    id: 'positions-nav',
    target: '[data-tour="positions-nav"]',
    placement: 'right',
    route: '/home',
    tiers: ['hr_admin'],
  },
  {
    id: 'notifications-bell',
    target: '[data-tour="notifications-bell"]',
    placement: 'bottom',
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
  },
  {
    id: 'dark-mode-toggle',
    target: '[data-tour="dark-mode-toggle"]',
    placement: 'right',
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
  },
  {
    id: 'linked-channels-tab',
    target: '[data-tour="linked-channels-tab"]',
    placement: 'bottom',
    route: LINKED_CHANNELS_ROUTE,
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
  },
  {
    id: 'linked-channel-telegram',
    target: '[data-tour="linked-channel-telegram"]',
    placement: 'right',
    route: LINKED_CHANNELS_ROUTE,
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
    descriptionValues: { botHandle: TELEGRAM_BOT_HANDLE },
  },
  {
    id: 'linked-channel-slack',
    target: '[data-tour="linked-channel-slack"]',
    placement: 'right',
    route: LINKED_CHANNELS_ROUTE,
    tiers: ['hr_admin', 'dept_manager', 'team_lead', 'employee'],
    descriptionValues: { appName: SLACK_APP_NAME },
  },
] as const;
