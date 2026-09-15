import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionDecision } from '../../generated/prisma';
import { ActionExecutionOutcome, DownstreamRequestContext, DownstreamResult, DownstreamSummary } from './downstream-client.types';
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

/** One employee in scope with no approved leave request overlapping the window. */
export interface EmployeeWithoutLeaveEntry {
  employeeId: string;
  employeeName: string;
}

/** Raw shape returned by HR Core's GET /analytics/employees-without-leave. */
interface EmployeesWithoutLeaveRaw {
  entries: EmployeeWithoutLeaveEntry[];
  totalConsidered: number;
  windowStart: string;
  windowEnd: string;
}

export interface EmployeesWithoutLeaveContext extends DownstreamSummary {
  entries: EmployeeWithoutLeaveEntry[];
  totalConsidered: number;
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

/**
 * Narrowing selector forwarded to HR Core's GET /analytics/dashboard.
 *
 * WHY only ids and no `level`: HR Core's `buildScopedEmployeeWhere` reads
 * businessUnitId / departmentId / teamId exclusively — `level` is never
 * consulted. Sending `level=dept` without a departmentId would silently
 * return organization-wide figures, which is precisely the failure this
 * type exists to prevent.
 */
export interface DashboardScopeSelector {
  departmentId?: string | null;
  teamId?: string | null;
  businessUnitId?: string | null;
}

/**
 * The population a dashboard payload actually describes.
 *
 * WHY this is never omitted, not even for the unscoped call: an absent scope
 * field lets the LLM assume the numbers match whatever the user asked about,
 * so organization-wide totals get relabelled as "the HR team's". A present,
 * explicit `ORGANIZATION` label contradicts that assumption directly.
 */
export interface DashboardScopeEcho {
  level: 'ORGANIZATION' | 'BUSINESS_UNIT' | 'DEPARTMENT' | 'TEAM';
  label: string;
  departmentId: string | null;
  teamId: string | null;
  businessUnitId: string | null;
}

/** A dashboard payload paired with the population it covers. */
export interface ScopedDashboardAiContext extends DashboardAiContext {
  scope: DashboardScopeEcho;
}

/** One selectable org unit the analytics scope selector accepts. */
export interface OrgUnitRef {
  id: string;
  name: string;
  code?: string | null;
  departmentId?: string | null;
}

export interface OrgUnitsAiContext extends DownstreamSummary {
  departments: OrgUnitRef[];
  teams: OrgUnitRef[];
  /**
   * WHY surfaced rather than swallowed: TeamsService.findAll returns only the
   * caller's own team for a non-admin manager, and both lists are page-limited.
   * Without this flag the LLM would read a short list as the whole org and
   * confidently answer "there is no HR department".
   */
  listIncomplete: boolean;
  incompleteReason: string | null;
}

/** Cursor page envelope returned by HR Core's org-unit list endpoints. */
interface OrgUnitPageRaw {
  data?: Array<{ id?: string; name?: string; code?: string | null; departmentId?: string | null }>;
  nextCursor?: string | null;
  total?: number;
}

/** Matches HR Core's `@IsUUID()` on DashboardAnalyticsQueryDto scope params. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Highest-resolution selector wins: team narrows more than department, which narrows more than BU. */
function describeScope(
  selector: DashboardScopeSelector,
  names: { departmentName?: string | null; teamName?: string | null; businessUnitName?: string | null } = {},
): DashboardScopeEcho {
  const departmentId = selector.departmentId ?? null;
  const teamId = selector.teamId ?? null;
  const businessUnitId = selector.businessUnitId ?? null;

  if (teamId) {
    return {
      level: 'TEAM',
      label: names.teamName ? `Team: ${names.teamName}` : `Team ${teamId}`,
      departmentId,
      teamId,
      businessUnitId,
    };
  }
  if (departmentId) {
    return {
      level: 'DEPARTMENT',
      label: names.departmentName ? `Department: ${names.departmentName}` : `Department ${departmentId}`,
      departmentId,
      teamId,
      businessUnitId,
    };
  }
  if (businessUnitId) {
    return {
      level: 'BUSINESS_UNIT',
      label: names.businessUnitName ? `Business unit: ${names.businessUnitName}` : `Business unit ${businessUnitId}`,
      departmentId,
      teamId,
      businessUnitId,
    };
  }
  return {
    level: 'ORGANIZATION',
    label: 'Entire organization — every department and team combined, not any single group',
    departmentId: null,
    teamId: null,
    businessUnitId: null,
  };
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

/** Mirrors HR Core LeaveType (spec 017 — resolving "sick"/"annual" phrasing to an id). */
export interface LeaveTypeContext {
  id: string;
  businessUnitId: string;
  name: string;
  defaultDaysPerYear: number | string;
  accrualFrequency: string;
  maxCarryoverDays: number | string;
  requiresApproval: boolean;
  isActive: boolean;
  color: string | null;
}

export interface LeaveTypesAiContext extends DownstreamSummary {
  leaveTypes: LeaveTypeContext[];
}

/**
 * Mirrors HR Core's raw LeaveRequest scalars for GET /leave-requests/:id
 * (spec 017 Verify phase — the independent read-back). WHY not the existing
 * LeaveRequestContext: that shape is for the list endpoint, which HR Core does
 * NOT include a nested leaveType relation on for the single-record read
 * (requests.service.ts findOne has no `include`) — reusing it here would
 * silently promise a field that is never populated.
 */
export interface LeaveRequestRecordContext {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  startHalfDay: string | null;
  endHalfDay: string | null;
  totalDays: number | string;
  reason: string | null;
  status: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The identity facts Reason resolves before anything else (spec 017 Design
 * Stance). WHY not businessUnitId here: it is already a JWT claim on
 * AiActorContext — no fetch needed for it. gender and country ARE fetched
 * here because they are not on the JWT; both are nullable and every consumer
 * must degrade independently rather than guessing.
 */
export interface EmployeeProfileContext {
  id: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  /** ISO-3166-1 alpha-2, resolved by HR Core from the employee's business unit. */
  country: string | null;
}

/** Frozen at Propose time; sent to HR Core verbatim at Execute (spec 017 FR-001). */
export interface CreateLeaveRequestPayload {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
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

  /**
   * WHY: "Who hasn't taken leave" cannot be derived from any leave-request-shaped
   * data (see getTeamAbsenceSummaryContext) — it requires HR Core to diff the full
   * scoped roster against approved leave history server-side. This method just
   * forwards that pre-computed result; no reshaping needed beyond the DownstreamResult
   * envelope, since HR Core's response already matches the AI-facing shape.
   */
  async getEmployeesWithoutLeaveContext(
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<EmployeesWithoutLeaveContext>> {
    const result = await this.get<EmployeesWithoutLeaveRaw>(
      '/analytics/employees-without-leave',
      context,
      'LEAVE_ZERO_SUMMARY',
      'Employees without leave',
    );

    if (result.permissionDecision !== PermissionDecision.ALLOWED) {
      return { ...result, data: null };
    }

    return {
      ...result,
      data: {
        id: 'leave:zero-leave-summary',
        entries: result.data?.entries ?? [],
        totalConsidered: result.data?.totalConsidered ?? 0,
        windowStart: result.data?.windowStart ?? '',
        windowEnd: result.data?.windowEnd ?? '',
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

  /**
   * WHY businessUnitId is required, not optional-and-ignored: LeaveType is
   * business-unit-scoped (@@unique([name, businessUnitId])). An unscoped list
   * can surface a leave type from a different business unit that this
   * employee cannot actually use (spec 017 US1).
   */
  async getLeaveTypes(
    businessUnitId: string | null,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<LeaveTypesAiContext>> {
    const query = businessUnitId ? `?${new URLSearchParams({ businessUnitId }).toString()}` : '';
    const result = await this.get<LeaveTypeContext[]>(`/leave-types${query}`, context, 'LEAVE_TYPES', 'Leave types');

    if (result.permissionDecision !== PermissionDecision.ALLOWED) {
      return { ...result, data: null };
    }

    return {
      ...result,
      data: {
        id: 'leave:types',
        leaveTypes: Array.isArray(result.data) ? result.data : [],
      },
    };
  }

  /**
   * WHY a read-back method exists at all: the Verify phase (spec 017 FR-008)
   * must independently confirm a created record, not trust the 201 response.
   * Read-only — this method never mutates anything.
   */
  getLeaveRequestById(
    id: string,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<LeaveRequestRecordContext>> {
    return this.get<LeaveRequestRecordContext>(
      `/leave-requests/${encodeURIComponent(id)}`,
      context,
      'LEAVE_REQUEST_DETAIL',
      'Leave request detail',
    );
  }

  /**
   * WHY a separate method from getEmployeeContext (which returns the loose
   * DownstreamSummary and has no callers today): Reason's identity-resolution
   * step needs gender and country as checked, typed fields it can branch on —
   * not buried in an untyped `metadata` bag.
   */
  getEmployeeProfileContext(
    employeeId: string,
    context: DownstreamRequestContext,
  ): Promise<DownstreamResult<EmployeeProfileContext>> {
    return this.get<EmployeeProfileContext>(
      `/employees/${encodeURIComponent(employeeId)}`,
      context,
      'EMPLOYEE_PROFILE_DETAIL',
      'Employee profile',
    );
  }

  /**
   * WHY this is the client's first write method (spec 017 D5): every other
   * method on this client is a GET. FR-007 requires classifying a non-2xx
   * response, a timeout, and a network failure as three DISTINCT FAILED
   * causes, each carrying the specific downstream reason — the get()/
   * DownstreamResult pair this client otherwise uses collapses all of those
   * into a vague `degradedReason` string with no HTTP status or response
   * body, which is not enough for FR-010's "HR Core returned: <reason>"
   * requirement. ActionExecutionOutcome exists for exactly this gap.
   *
   * WHY no employeeId in the payload: HR Core's POST /leave-requests derives
   * the employee from the forwarded JWT server-side (requireEmployeeId(user)
   * in requests.controller.ts) — it does not accept one in the body. The
   * employeeId on the frozen confirmation payload is for display only.
   */
  createLeaveRequest(
    payload: CreateLeaveRequestPayload,
    context: DownstreamRequestContext,
  ): Promise<ActionExecutionOutcome<LeaveRequestRecordContext>> {
    const baseUrl = this.config.get<string>('aiAgentic.hrCoreUrl') ?? 'http://localhost:3001';
    return this.http.post<LeaveRequestRecordContext>(baseUrl, '/leave-requests', payload, context, 'Leave request submission');
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

  /**
   * WHY the scope selector and the returned `scope` echo are inseparable: HR Core
   * defaults an unqualified /analytics/dashboard call to the caller's full visible
   * population. For an HR_ADMIN that is the whole company, so a question about one
   * department silently receives company-wide aggregates. Forwarding the ids fixes
   * the numbers; echoing the resulting population back tells the consumer which
   * group those numbers describe, so an unscoped result can never be narrated as a
   * departmental one.
   *
   * Names are optional and used only for the human-readable label — the ids are
   * what HR Core filters on.
   */
  async getDashboardContext(
    context: DownstreamRequestContext,
    selector: DashboardScopeSelector = {},
    names: { departmentName?: string | null; teamName?: string | null; businessUnitName?: string | null } = {},
  ): Promise<DownstreamResult<ScopedDashboardAiContext>> {
    const query = new URLSearchParams();
    if (selector.departmentId) query.set('departmentId', selector.departmentId);
    if (selector.teamId) query.set('teamId', selector.teamId);
    if (selector.businessUnitId) query.set('businessUnitId', selector.businessUnitId);

    const queryString = query.toString();
    const path = queryString.length > 0 ? `/analytics/dashboard?${queryString}` : '/analytics/dashboard';
    const result = await this.get<DashboardAiContext>(path, context, 'DASHBOARD', 'Dashboard analytics');

    if (result.permissionDecision !== PermissionDecision.ALLOWED || result.data == null) {
      return { ...result, data: null };
    }

    return { ...result, data: { ...result.data, scope: describeScope(selector, names) } };
  }

  /**
   * WHY a lookup tool rather than name matching inside the agent: department and
   * team names are tenant data ("People Ops", "Human Resources", "HR & Talent"),
   * so any hardcoded alias table in the AI service would rot. The LLM matches the
   * user's phrasing against the real list, then passes back the id that
   * getDashboardContext can actually filter on.
   */
  async getOrgUnitsContext(context: DownstreamRequestContext): Promise<DownstreamResult<OrgUnitsAiContext>> {
    const [departmentsResult, teamsResult] = await Promise.all([
      this.get<OrgUnitPageRaw>('/departments?limit=200', context, 'ORG_UNITS', 'Departments and teams'),
      this.get<OrgUnitPageRaw>('/teams?limit=200', context, 'ORG_UNITS', 'Departments and teams'),
    ]);

    if (departmentsResult.permissionDecision !== PermissionDecision.ALLOWED) {
      return { ...departmentsResult, data: null };
    }

    const departmentsPage = departmentsResult.data;
    const teamsPage = teamsResult.permissionDecision === PermissionDecision.ALLOWED ? teamsResult.data : null;

    const departments: OrgUnitRef[] = (departmentsPage?.data ?? [])
      .filter((row): row is { id: string; name: string; code?: string | null } =>
        typeof row.id === 'string' && typeof row.name === 'string')
      .map((row) => ({ id: row.id, name: row.name, code: row.code ?? null }));

    const teams: OrgUnitRef[] = (teamsPage?.data ?? [])
      .filter((row): row is { id: string; name: string; departmentId?: string | null } =>
        typeof row.id === 'string' && typeof row.name === 'string')
      .map((row) => ({ id: row.id, name: row.name, departmentId: row.departmentId ?? null }));

    const reasons: string[] = [];
    if (teamsResult.permissionDecision !== PermissionDecision.ALLOWED) {
      reasons.push('The team list is not visible with your permissions.');
    } else if (teamsPage?.nextCursor) {
      reasons.push('More teams exist than were returned in this page.');
    }
    if (departmentsPage?.nextCursor) {
      reasons.push('More departments exist than were returned in this page.');
    }

    return {
      data: {
        id: 'org:units',
        departments,
        teams,
        listIncomplete: reasons.length > 0,
        incompleteReason: reasons.length > 0 ? reasons.join(' ') : null,
      },
      permissionDecision: PermissionDecision.ALLOWED,
      degradedReason: reasons.length > 0 ? reasons.join(' ') : null,
      sourceType: 'ORG_UNITS',
      sourceTitle: 'Departments and teams',
    };
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
    /**
     * WHY: No status filter here — the LLM needs visibility into PENDING and
     * REJECTED requests too (e.g. "when was my last rejected leave request?"),
     * not just APPROVED ones. HR Core already scopes this to the caller's own
     * employeeId server-side.
     */
    const [balancesResult, requestsResult] = await Promise.all([
      this.get<LeaveBalanceContext[]>(balancePath, context, 'LEAVE', 'Leave balance and history'),
      this.get<LeaveRequestContext[]>('/leave-requests', context, 'LEAVE', 'Leave balance and history'),
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
