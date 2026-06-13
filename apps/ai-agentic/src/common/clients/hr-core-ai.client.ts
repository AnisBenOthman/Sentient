import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionDecision } from '../../generated/prisma';
import { DownstreamRequestContext, DownstreamResult, DownstreamSummary } from './downstream-client.types';
import { HttpJsonClient } from './http-json.client';

export interface LeaveBalanceContext {
  id: string;
  leaveTypeName: string;
  year: number;
  totalDays: number | string;
  usedDays: number | string;
  pendingDays: number | string;
  remainingDays: number | string;
}

export interface LeaveRequestContext {
  id: string;
  leaveType?: {
    name?: string | null;
  } | null;
  startDate: string;
  endDate: string;
  totalDays: number | string;
  status: string;
}

export interface LeaveAiContext extends DownstreamSummary {
  balances: LeaveBalanceContext[];
  recentRequests: LeaveRequestContext[];
  requestHistoryUnavailable?: boolean;
}

/** Mirrors HR Core RequestsService.TeamCalendarEntry (dates serialize to ISO strings). */
export interface TeamCalendarEntryContext {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
}

export interface TeamLeaveAiContext extends DownstreamSummary {
  entries: TeamCalendarEntryContext[];
  windowStart: string;
  windowEnd: string;
}

/** Per-employee aggregation over a historical leave window. */
export interface AbsenceSummaryEntry {
  employeeId: string;
  employeeName: string;
  /** Number of distinct approved-leave periods in the window. */
  spells: number;
  /** Approximate total calendar days (inclusive start→end). */
  calendarDays: number;
}

export interface TeamAbsenceSummaryContext extends DownstreamSummary {
  entries: AbsenceSummaryEntry[];
  windowStart: string;
  windowEnd: string;
}

/** Mirrors HR Core Holiday (dates serialize to ISO strings). */
export interface HolidayContext {
  id: string;
  name: string;
  date: string;
  isRecurring: boolean;
  year?: number | null;
}

export interface HolidayAiContext extends DownstreamSummary {
  holidays: HolidayContext[];
  year: number;
}

/** Mirrors HR Core ObjectiveResponseDto (subset the assistant summarizes). */
export interface OkrObjectiveContext {
  id: string;
  title: string;
  level?: string | null;
  status?: string | null;
  ownerId?: string | null;
}

export interface OkrAiContext extends DownstreamSummary {
  objectives: OkrObjectiveContext[];
}

interface ObjectiveListResponse {
  items?: OkrObjectiveContext[];
  nextCursor?: string | null;
}

/** Mirrors HR Core AnalyticsService.DashboardAnalytics (subset the assistant summarizes). */
export interface DashboardAiContext extends DownstreamSummary {
  employees?: {
    total?: number;
    active?: number;
    onLeave?: number;
    probation?: number;
    /** Count of employees with TERMINAL employment status (used for EMPLOYEES_EXITS threshold). */
    terminal?: number;
    /** Attrition rate as a percentage, e.g. 5.2 means 5.2% (not 0.052). */
    attritionRate?: number | null;
  } | null;
  leave?: {
    pendingApprovals?: number;
  } | null;
  skills?: {
    averageScore?: number | null;
    skillsTracked?: number;
    topSkill?: string | null;
  } | null;
}

/** One HR Core ThresholdIndicator row (active thresholds only). */
export interface ThresholdConfig {
  id: string;
  metricKey: string;
  label: string;
  /** Alert when value >= this (null = not configured). */
  warningThreshold: number | null;
  /** Alert when value >= this (null = not configured). */
  criticalThreshold: number | null;
  /** Alert when value <= this (null = not configured). */
  warningBelow: number | null;
  /** Alert when value <= this (null = not configured). */
  criticalBelow: number | null;
}

export interface KpiAlert {
  metricKey: string;
  label: string;
  currentValue: number;
  severity: 'CRITICAL' | 'WARNING';
  /** The threshold value that was crossed. */
  threshold: number;
  /** ABOVE = high-is-bad metric crossed upward; BELOW = low-is-bad metric crossed downward. */
  direction: 'ABOVE' | 'BELOW';
}

export interface KpiAlertContext extends DownstreamSummary {
  alerts: KpiAlert[];
  /** How many configured thresholds had a current value to compare against. */
  checkedCount: number;
  /** Threshold labels that could not be checked (no current value in dashboard analytics). */
  uncheckedMetrics: string[];
}

const TEAM_COVERAGE_WINDOW_DAYS = 30;

/**
 * Raw shape needed for threshold evaluation — a superset of DashboardAiContext
 * that includes fields the KPI alert logic requires but the AI summary omits.
 */
interface DashboardKpiRaw {
  employees?: {
    terminal?: number;
    attritionRate?: number | null;
    probation?: number;
    [key: string]: unknown;
  } | null;
  leave?: {
    pendingApprovals?: number;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

interface ThresholdBreachResult {
  severity: 'CRITICAL' | 'WARNING';
  threshold: number;
  direction: 'ABOVE' | 'BELOW';
}

/**
 * WHY: Critical threshold is checked before warning so a metric that crosses
 * both only gets the highest-severity label. Above-threshold checks run before
 * below-threshold checks — a metric cannot be both types simultaneously.
 */
function evaluateThreshold(value: number, config: ThresholdConfig): ThresholdBreachResult | null {
  if (config.criticalThreshold != null && value >= config.criticalThreshold) {
    return { severity: 'CRITICAL', threshold: config.criticalThreshold, direction: 'ABOVE' };
  }
  if (config.warningThreshold != null && value >= config.warningThreshold) {
    return { severity: 'WARNING', threshold: config.warningThreshold, direction: 'ABOVE' };
  }
  if (config.criticalBelow != null && value <= config.criticalBelow) {
    return { severity: 'CRITICAL', threshold: config.criticalBelow, direction: 'BELOW' };
  }
  if (config.warningBelow != null && value <= config.warningBelow) {
    return { severity: 'WARNING', threshold: config.warningBelow, direction: 'BELOW' };
  }
  return null;
}

@Injectable()
export class HrCoreAiClient {
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpJsonClient,
  ) {}

  getEmployeeContext(employeeId: string, context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get(`/employees/${encodeURIComponent(employeeId)}`, context, 'EMPLOYEE_PROFILE', 'Employee profile');
  }

  getLeaveContext(
    employeeId: string | null,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<LeaveAiContext>> {
    if (!employeeId) {
      return Promise.resolve({
        data: null,
        permissionDecision: PermissionDecision.UNAVAILABLE,
        degradedReason: 'Caller is not linked to an employee record.',
        sourceType: 'LEAVE',
        sourceTitle: 'Leave balance and history',
      });
    }

    const query = new URLSearchParams({
      employeeId,
      year: String(new Date().getUTCFullYear()),
    });
    return this.getLeaveBalanceAndHistory(`/leave-balances?${query.toString()}`, context);
  }

  /**
   * WHY: Manager and HR-admin team-coverage questions (FR-008) use HR Core's
   * team-calendar endpoint, which already strips private fields (no reason) and
   * enforces TEAM/GLOBAL scope server-side — a 403 degrades gracefully here.
   */
  async getTeamLeaveContext(context: DownstreamRequestContext): Promise<DownstreamResult<TeamLeaveAiContext>> {
    const windowStart = new Date();
    const windowEnd = new Date(windowStart.getTime() + TEAM_COVERAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const from = windowStart.toISOString().slice(0, 10);
    const to = windowEnd.toISOString().slice(0, 10);
    const query = new URLSearchParams({ from, to });
    const result = await this.get<TeamCalendarEntryContext[]>(
      `/leave-requests/team-calendar?${query.toString()}`,
      context,
      'LEAVE_COVERAGE',
      'Team leave coverage',
    );

    if (result.permissionDecision !== PermissionDecision.ALLOWED) {
      return { ...result, data: null };
    }

    return {
      ...result,
      data: {
        id: 'leave:team-coverage',
        entries: Array.isArray(result.data) ? result.data : [],
        windowStart: from,
        windowEnd: to,
      },
    };
  }

  /**
   * WHY: Absence-frequency questions ("who is always absent") need a historical
   * window, not the forward-looking team-calendar window. This method queries the
   * past 365 days and aggregates per employee so the caller never receives raw
   * individual rows — just spell counts and calendar day totals, ranked descending.
   * HR Core's scope filter (TEAM/GLOBAL via JWT claims) is enforced server-side.
   */
  async getTeamAbsenceSummaryContext(context: DownstreamRequestContext): Promise<DownstreamResult<TeamAbsenceSummaryContext>> {
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
    const from = windowStart.toISOString().slice(0, 10);
    const to = windowEnd.toISOString().slice(0, 10);
    const query = new URLSearchParams({ from, to });

    const result = await this.get<TeamCalendarEntryContext[]>(
      `/leave-requests/team-calendar?${query.toString()}`,
      context,
      'LEAVE_ABSENCE_SUMMARY',
      'Team absence summary',
    );

    if (result.permissionDecision !== PermissionDecision.ALLOWED) {
      return { ...result, data: null };
    }

    const rawEntries = Array.isArray(result.data) ? result.data : [];
    const byEmployee = new Map<string, AbsenceSummaryEntry>();
    for (const entry of rawEntries) {
      const days = HrCoreAiClient.calendarDaysBetween(entry.startDate, entry.endDate);
      const existing = byEmployee.get(entry.employeeId);
      if (existing) {
        existing.spells += 1;
        existing.calendarDays += days;
      } else {
        byEmployee.set(entry.employeeId, {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          spells: 1,
          calendarDays: days,
        });
      }
    }

    const sortedEntries = [...byEmployee.values()].sort(
      (a, b) => b.spells - a.spells || b.calendarDays - a.calendarDays,
    );

    return {
      ...result,
      data: {
        id: 'leave:absence-summary',
        entries: sortedEntries,
        windowStart: from,
        windowEnd: to,
      },
    };
  }

  private static calendarDaysBetween(startDate: string, endDate: string): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / msPerDay) + 1);
  }

  /**
   * WHY: "bank holidays in my country" routes to the Leave Agent, which needs
   * real Holiday rows rather than a generic answer. The actor's business unit
   * scopes the list when known; HR Core includes recurring holidays for the
   * requested year.
   */
  async getHolidaysContext(
    businessUnitId: string | null,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<HolidayAiContext>> {
    const year = new Date().getUTCFullYear();
    const query = new URLSearchParams({ year: String(year) });
    if (businessUnitId) query.set('businessUnitId', businessUnitId);
    const result = await this.get<HolidayContext[]>(
      `/holidays?${query.toString()}`,
      context,
      'HOLIDAYS',
      'Company holidays',
    );

    if (result.permissionDecision !== PermissionDecision.ALLOWED) {
      return { ...result, data: null };
    }

    return {
      ...result,
      data: {
        id: 'leave:holidays',
        holidays: Array.isArray(result.data) ? result.data : [],
        year,
      },
    };
  }

  /** WHY: HR Core has no /okrs/my-okrs route; objectives are owner-filtered via /objectives. */
  async getOkrContext(
    ownerUserId: string | null,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<OkrAiContext>> {
    const path = ownerUserId
      ? `/objectives?${new URLSearchParams({ ownerId: ownerUserId }).toString()}`
      : '/objectives';
    const result = await this.get<ObjectiveListResponse>(path, context, 'OKR', 'OKR context');

    if (result.permissionDecision !== PermissionDecision.ALLOWED) {
      return { ...result, data: null };
    }

    const items = result.data?.items;
    return {
      ...result,
      data: {
        id: 'okr:objectives',
        objectives: Array.isArray(items) ? items : [],
      },
    };
  }

  getPerformanceContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/performance-reviews', context, 'PERFORMANCE', 'Performance review context');
  }

  getSkillsContext(
    employeeId: string | null,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<DownstreamSummary>> {
    if (!employeeId) {
      return Promise.resolve({
        data: null,
        permissionDecision: PermissionDecision.UNAVAILABLE,
        degradedReason: 'Caller is not linked to an employee record.',
        sourceType: 'SKILLS',
        sourceTitle: 'Skills context',
      });
    }
    return this.get(`/employees/${encodeURIComponent(employeeId)}/skills`, context, 'SKILLS', 'Skills context');
  }

  getNotificationsContext(context: DownstreamRequestContext): Promise<DownstreamResult<DownstreamSummary>> {
    return this.get('/notifications', context, 'NOTIFICATIONS', 'Notifications');
  }

  getDashboardContext(context: DownstreamRequestContext): Promise<DownstreamResult<DashboardAiContext>> {
    return this.get<DashboardAiContext>('/analytics/dashboard', context, 'DASHBOARD', 'Dashboard analytics');
  }

  /**
   * WHY: KPI threshold alerts require two separate fetches — active threshold config
   * from /threshold-indicators plus current metric values from /analytics/dashboard.
   * Comparison is done here (not in Gemini) so the LLM receives a pre-computed
   * alert list rather than raw numbers it might misinterpret.
   * PROMOTIONS_PENDING_REQUESTS has no corresponding field in dashboard analytics
   * (the endpoint only exposes total historical promotions, not pending) so it is
   * flagged as unchecked.
   */
  async getKpiAlertsContext(context: DownstreamRequestContext): Promise<DownstreamResult<KpiAlertContext>> {
    const [thresholdsResult, dashboardResult] = await Promise.all([
      this.get<ThresholdConfig[]>('/threshold-indicators', context, 'KPI_THRESHOLDS', 'KPI thresholds'),
      this.get<DashboardKpiRaw>('/analytics/dashboard', context, 'DASHBOARD', 'Dashboard analytics'),
    ]);

    if (thresholdsResult.permissionDecision !== PermissionDecision.ALLOWED) {
      return { ...thresholdsResult, data: null };
    }
    if (dashboardResult.permissionDecision !== PermissionDecision.ALLOWED) {
      return { ...dashboardResult, data: null };
    }

    const thresholds = Array.isArray(thresholdsResult.data) ? thresholdsResult.data : [];
    const dash = dashboardResult.data;

    const metricValues: Record<string, number | null> = {
      EMPLOYEES_EXITS: dash?.employees?.terminal ?? null,
      EMPLOYEES_ATTRITION_RATE: dash?.employees?.attritionRate ?? null,
      EMPLOYEES_PROBATION: dash?.employees?.probation ?? null,
      LEAVE_PENDING_APPROVALS: dash?.leave?.pendingApprovals ?? null,
      // Dashboard analytics exposes only total historical promotions, not pending
      PROMOTIONS_PENDING_REQUESTS: null,
    };

    const alerts: KpiAlert[] = [];
    const uncheckedMetrics: string[] = [];
    let checkedCount = 0;

    for (const threshold of thresholds) {
      const currentValue = metricValues[threshold.metricKey] ?? null;
      if (currentValue === null) {
        uncheckedMetrics.push(threshold.label);
        continue;
      }
      checkedCount += 1;
      const breach = evaluateThreshold(currentValue, threshold);
      if (breach) {
        alerts.push({
          metricKey: threshold.metricKey,
          label: threshold.label,
          currentValue,
          severity: breach.severity,
          threshold: breach.threshold,
          direction: breach.direction,
        });
      }
    }

    return {
      data: {
        id: 'kpi:threshold-alerts',
        alerts,
        checkedCount,
        uncheckedMetrics,
      },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: null,
      sourceType: 'KPI_THRESHOLDS',
      sourceTitle: 'KPI threshold alerts',
    };
  }

  private async getLeaveBalanceAndHistory(
    balancePath: string,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<LeaveAiContext>> {
    const historyQuery = new URLSearchParams({ status: 'APPROVED' });
    const [balancesResult, requestsResult] = await Promise.all([
      this.get<LeaveBalanceContext[]>(balancePath, context, 'LEAVE', 'Leave balance and history'),
      this.get<LeaveRequestContext[]>(
        `/leave-requests?${historyQuery.toString()}`,
        context,
        'LEAVE',
        'Leave balance and history',
      ),
    ]);

    if (balancesResult.permissionDecision !== PermissionDecision.ALLOWED) {
      return {
        ...balancesResult,
        data: null,
      };
    }

    return {
      data: {
        id: 'leave:current-year',
        balances: balancesResult.data ?? [],
        recentRequests: requestsResult.permissionDecision === PermissionDecision.ALLOWED
          ? requestsResult.data ?? []
          : [],
        requestHistoryUnavailable: requestsResult.permissionDecision !== PermissionDecision.ALLOWED,
      },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: requestsResult.permissionDecision === PermissionDecision.ALLOWED
        ? null
        : requestsResult.degradedReason,
      sourceType: 'LEAVE',
      sourceTitle: 'Leave balance and history',
    };
  }

  private get<TData = DownstreamSummary>(
    path: string,
    context: DownstreamRequestContext,
    sourceType: string,
    sourceTitle: string,
  ): Promise<DownstreamResult<TData>> {
    const baseUrl = this.config.get<string>('aiAgentic.hrCoreUrl') ?? 'http://localhost:3001';
    return this.http.get<TData>(baseUrl, path, context, sourceType, sourceTitle);
  }
}
