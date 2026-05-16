import { hrClient } from './client';
import type {
  PerformanceRating,
  PerformanceReviewAuditDto,
  PerformanceReviewCycleDto,
  PerformanceReviewCycleInitiationDto,
  PerformanceReviewCycleSummaryDto,
  PerformanceReviewDto,
  PerformanceReviewListDto,
  PerformanceReviewSalaryFollowUpDto,
  ReviewType,
  SatisfactionLevel,
} from '@sentient/shared';
import { PromotionRequestStatus } from '@sentient/shared';
import type {
  NotificationCategory,
  NotificationEventType,
  NotificationStatus,
} from '@sentient/shared';

// ── Auth ──────────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await hrClient.post<LoginResponse>('/auth/login', {
    email,
    password,
    channel: 'WEB',
  });
  return data;
}

export async function logout(): Promise<void> {
  await hrClient.post('/auth/logout');
}

// ── Employees ─────────────────────────────────────────────────────────────

export interface EmployeeNested {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
}

export interface EmployeeProfile {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  hireDate: string;
  contractType: string;
  employmentStatus: string;
  grossSalary: number | null;
  netSalary: number | null;
  maritalStatus: string | null;
  educationLevel: string | null;
  educationField?: string | null;
  positionId?: string | null;
  departmentId?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  deletedAt: string | null;
  department: {
    id: string;
    name: string;
    businessUnitId?: string;
    businessUnit?: { id: string; name: string } | null;
  } | null;
  team: {
    id: string;
    name: string;
    businessUnitId?: string;
    businessUnit?: { id: string; name: string } | null;
  } | null;
  position: { id: string; title: string } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  salaryHistory?: SalaryHistoryEntry[];
}

export interface PaginatedEmployees {
  data: EmployeeProfile[];
  total: number;
  page: number;
  limit: number;
}

type ApiEmployeeProfile = Omit<EmployeeProfile, "grossSalary" | "netSalary"> & {
  grossSalary: number | string | null;
  netSalary: number | string | null;
};

type ApiPaginatedEmployees = Omit<PaginatedEmployees, "data"> & {
  data: ApiEmployeeProfile[];
};

function normalizeEmployeeProfile(employee: ApiEmployeeProfile): EmployeeProfile {
  return {
    ...employee,
    grossSalary: toNullableNumber(employee.grossSalary),
    netSalary: toNullableNumber(employee.netSalary),
  };
}

export async function getEmployees(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  employmentStatus?: string;
  businessUnitId?: string;
  departmentId?: string;
  teamId?: string;
  includeCompensation?: boolean;
}): Promise<PaginatedEmployees> {
  const { status, ...rest } = params ?? {};
  const queryParams = status ? { ...rest, employmentStatus: status } : rest;
  const { data } = await hrClient.get<ApiPaginatedEmployees>('/employees', { params: queryParams });
  return {
    ...data,
    data: data.data.map(normalizeEmployeeProfile),
  };
}

export async function getEmployee(id: string): Promise<EmployeeProfile> {
  const { data } = await hrClient.get<ApiEmployeeProfile>(`/employees/${id}`);
  return normalizeEmployeeProfile(data);
}

export type UpdateEmployeeDto = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  contractType: string;
  grossSalary: string;
  netSalary: string;
  salaryChangeReason: string;
  salaryChangeComment: string;
  maritalStatus: string;
  educationLevel: string;
  educationField: string;
  positionId: string;
  departmentId: string;
  teamId: string;
  managerId: string;
}>;

export async function updateEmployee(
  id: string,
  dto: UpdateEmployeeDto,
): Promise<EmployeeProfile> {
  const { data } = await hrClient.patch<ApiEmployeeProfile>(`/employees/${id}`, dto);
  return normalizeEmployeeProfile(data);
}

export interface CreateEmployeeDto {
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  contractType: string;
  phone?: string;
  dateOfBirth?: string;
  grossSalary?: string;
  netSalary?: string;
  departmentId?: string;
  teamId?: string;
  positionId?: string;
}

export async function createEmployee(dto: CreateEmployeeDto): Promise<EmployeeProfile> {
  const { data } = await hrClient.post<ApiEmployeeProfile>('/employees', dto);
  return normalizeEmployeeProfile(data);
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  businessUnitId: string;
  headId: string | null;
  businessUnit: { id: string; name: string } | null;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  departmentId: string;
  leadId: string | null;
  projectFocus: string | null;
  department: { id: string; name: string } | null;
}

export interface Position {
  id: string;
  title: string;
  level: string | null;
  isKeyPosition: boolean;
  keyPositionRisk: string | null;
  hasSuccessor: boolean;
  isActive: boolean;
}

export async function getDepartments(): Promise<Department[]> {
  const { data } = await hrClient.get<{ data: Department[] } | Department[]>('/departments', { params: { limit: 200 } });
  return Array.isArray(data) ? data : data.data;
}

export async function getTeams(): Promise<Team[]> {
  const { data } = await hrClient.get<{ data: Team[] } | Team[]>('/teams', { params: { limit: 200 } });
  return Array.isArray(data) ? data : data.data;
}

export async function getPositions(): Promise<Position[]> {
  const { data } = await hrClient.get<{ data: Position[] } | Position[]>('/positions', { params: { limit: 200 } });
  return Array.isArray(data) ? data : data.data;
}

export async function createPosition(dto: {
  title: string;
  level?: string;
  isKeyPosition?: boolean;
  keyPositionRisk?: string;
  hasSuccessor?: boolean;
}): Promise<Position> {
  const { data } = await hrClient.post<Position>('/positions', dto);
  return data;
}

export async function updatePosition(
  id: string,
  dto: Partial<{
    title: string;
    level: string;
    isKeyPosition: boolean;
    keyPositionRisk: string;
    hasSuccessor: boolean;
  }>,
): Promise<Position> {
  const { data } = await hrClient.patch<Position>(`/positions/${id}`, dto);
  return data;
}

export async function deactivatePosition(id: string): Promise<void> {
  await hrClient.delete(`/positions/${id}`);
}

// ── Business Units ────────────────────────────────────────────────────────

export interface BusinessUnit {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  createdAt: string;
}

export async function getBusinessUnits(): Promise<BusinessUnit[]> {
  const { data } = await hrClient.get<{ data: BusinessUnit[] } | BusinessUnit[]>(
    '/business-units', { params: { limit: 200 } },
  );
  return Array.isArray(data) ? data : data.data;
}

export async function createBusinessUnit(dto: { name: string; address: string }): Promise<BusinessUnit> {
  const { data } = await hrClient.post<BusinessUnit>('/business-units', dto);
  return data;
}

export async function updateBusinessUnit(
  id: string,
  dto: Partial<{ name: string; address: string; isActive: boolean }>,
): Promise<BusinessUnit> {
  const { data } = await hrClient.patch<BusinessUnit>(`/business-units/${id}`, dto);
  return data;
}

export async function deleteBusinessUnit(id: string): Promise<void> {
  await hrClient.delete(`/business-units/${id}`);
}

// ── Department CRUD ───────────────────────────────────────────────────────

export interface CreateDepartmentPayload {
  name: string;
  code: string;
  businessUnitId: string;
  description?: string;
  headId?: string;
}

export async function createDepartment(dto: CreateDepartmentPayload): Promise<Department> {
  const { data } = await hrClient.post<Department>('/departments', dto);
  return data;
}

export async function updateDepartment(
  id: string,
  dto: Partial<CreateDepartmentPayload & { isActive: boolean }>,
): Promise<Department> {
  const { data } = await hrClient.patch<Department>(`/departments/${id}`, dto);
  return data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await hrClient.delete(`/departments/${id}`);
}

// ── Team CRUD ─────────────────────────────────────────────────────────────

export interface CreateTeamPayload {
  name: string;
  departmentId: string;
  code?: string;
  description?: string;
  projectFocus?: string;
  leadId?: string;
}

export async function createTeam(dto: CreateTeamPayload): Promise<Team> {
  const { data } = await hrClient.post<Team>('/teams', dto);
  return data;
}

export async function updateTeam(
  id: string,
  dto: Partial<CreateTeamPayload & { isActive: boolean }>,
): Promise<Team> {
  const { data } = await hrClient.patch<Team>(`/teams/${id}`, dto);
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  await hrClient.delete(`/teams/${id}`);
}

// ── Salary History ────────────────────────────────────────────────────────

export interface SalaryHistoryEntry {
  id: string;
  effectiveDate: string;
  grossBefore: number | null;
  grossAfter: number | null;
  netBefore: number | null;
  netAfter: number | null;
  reason: string | null;
  changedByName: string | null;
}

interface ApiSalaryHistoryEntry {
  id: string;
  effectiveDate: string;
  previousGrossSalary: number | string | null;
  newGrossSalary: number | string | null;
  previousNetSalary: number | string | null;
  newNetSalary: number | string | null;
  reason: string | null;
  changedById: string | null;
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getSalaryHistory(employeeId: string): Promise<SalaryHistoryEntry[]> {
  const { data } = await hrClient.get<ApiSalaryHistoryEntry[]>(
    `/employees/${employeeId}/salary-history`,
  );
  return data.map((entry) => ({
    id: entry.id,
    effectiveDate: entry.effectiveDate,
    grossBefore: toNullableNumber(entry.previousGrossSalary),
    grossAfter: toNullableNumber(entry.newGrossSalary),
    netBefore: toNullableNumber(entry.previousNetSalary),
    netAfter: toNullableNumber(entry.newNetSalary),
    reason: entry.reason,
    changedByName: entry.changedById,
  }));
}

// ── Leave Requests ────────────────────────────────────────────────────────

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  startHalfDay: string | null;
  endHalfDay: string | null;
  reason: string | null;
  status: string;
  reviewNote: string | null;
  submittedAt: string;
  leaveType?: { id: string; name: string; color: string | null };
  employee?: { id: string; firstName: string; lastName: string };
}

export async function getMyLeaveRequests(params?: {
  status?: string;
}): Promise<LeaveRequest[]> {
  const { data } = await hrClient.get<LeaveRequest[]>('/leave-requests', { params });
  return data;
}

export async function getEmployeeLeaveRequests(
  employeeId: string,
  params?: { status?: string },
): Promise<LeaveRequest[]> {
  const { data } = await hrClient.get<LeaveRequest[]>('/leave-requests', {
    params: { employeeId, ...params },
  });
  return data;
}

export async function getPendingLeaveQueue(): Promise<LeaveRequest[]> {
  const { data } = await hrClient.get<LeaveRequest[]>('/leave-requests/pending-queue');
  return data;
}

export async function createLeaveRequest(dto: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<LeaveRequest> {
  const { data } = await hrClient.post<LeaveRequest>('/leave-requests', dto);
  return data;
}

export async function approveLeaveRequest(id: string, reviewNote?: string): Promise<void> {
  await hrClient.post(`/leave-requests/${id}/approve`, { reviewNote: reviewNote ?? '' });
}

export async function rejectLeaveRequest(id: string, reviewNote: string): Promise<void> {
  await hrClient.post(`/leave-requests/${id}/reject`, { reviewNote });
}

export async function cancelLeaveRequest(id: string): Promise<void> {
  await hrClient.post(`/leave-requests/${id}/cancel`);
}

// ── Leave Balances ────────────────────────────────────────────────────────

export interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  leaveType?: { color: string | null };
}

export async function getLeaveBalances(
  employeeId: string,
  year?: number,
): Promise<LeaveBalance[]> {
  const { data } = await hrClient.get<LeaveBalance[]>('/leave-balances', {
    params: { employeeId, year: year ?? new Date().getFullYear() },
  });
  return data;
}

// ── Leave Types ───────────────────────────────────────────────────────────

export interface LeaveType {
  id: string;
  businessUnitId: string;
  name: string;
  defaultDaysPerYear: number;
  requiresApproval: boolean;
  accrualFrequency: string;
  maxCarryoverDays: number;
  color: string | null;
  isActive: boolean;
}

export async function getLeaveTypes(params?: {
  businessUnitId?: string;
  includeInactive?: boolean;
}): Promise<LeaveType[]> {
  const { data } = await hrClient.get<LeaveType[]>('/leave-types', { params });
  return data;
}

export async function reactivateLeaveType(id: string): Promise<LeaveType> {
  const { data } = await hrClient.post<LeaveType>(`/leave-types/${id}/reactivate`);
  return data;
}

export async function createLeaveType(dto: {
  businessUnitId: string;
  name: string;
  defaultDaysPerYear: number;
  requiresApproval: boolean;
  maxCarryoverDays?: number;
  accrualFrequency?: string;
  color?: string;
}): Promise<LeaveType> {
  const { data } = await hrClient.post<LeaveType>('/leave-types', dto);
  return data;
}

export async function updateLeaveType(
  id: string,
  dto: Partial<{
    name: string;
    defaultDaysPerYear: number;
    requiresApproval: boolean;
    maxCarryoverDays: number;
    color: string;
  }>,
): Promise<LeaveType> {
  const { data } = await hrClient.patch<LeaveType>(`/leave-types/${id}`, dto);
  return data;
}

export async function deleteLeaveType(id: string): Promise<void> {
  await hrClient.delete(`/leave-types/${id}`);
}

// ── Holidays ──────────────────────────────────────────────────────────────

export interface Holiday {
  id: string;
  businessUnitId: string;
  name: string;
  date: string;
  isRecurring: boolean;
  year: number | null;
}

export async function getHolidays(params?: {
  businessUnitId?: string;
  year?: number;
}): Promise<Holiday[]> {
  const { data } = await hrClient.get<Holiday[]>('/holidays', { params });
  return data;
}

export async function createHoliday(dto: {
  businessUnitId: string;
  name: string;
  date: string;
  isRecurring: boolean;
  year?: number | null;
}): Promise<Holiday> {
  const { data } = await hrClient.post<Holiday>('/holidays', dto);
  return data;
}

export async function updateHoliday(
  id: string,
  dto: Partial<{
    name: string;
    date: string;
    isRecurring: boolean;
    year: number | null;
  }>,
): Promise<Holiday> {
  const { data } = await hrClient.patch<Holiday>(`/holidays/${id}`, dto);
  return data;
}

export async function deleteHoliday(id: string): Promise<void> {
  await hrClient.delete(`/holidays/${id}`);
}

// ── Employee Skills ───────────────────────────────────────────────────────

export type SkillDomain = 'TECHNICAL' | 'LEADERSHIP' | 'SOFT_SKILLS' | 'DOMAIN_EXPERTISE';
export type SkillRequirementLevel = 'MANDATORY' | 'EXPECTED' | 'NICE_TO_HAVE';
export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface SkillRef {
  id: string;
  name: string;
  domain: SkillDomain | null;
  category: string | null;
}

export interface EmployeeSkill {
  id: string;
  skillId: string;
  proficiencyLevel: string;
  proficiency?: string;
  yearsOfExperience: number | null;
  skill: SkillRef;
}

export interface PositionSkill {
  id: string;
  positionId: string;
  skillId: string;
  skill: SkillRef;
  minimumProficiency: ProficiencyLevel;
  requirementLevel: SkillRequirementLevel;
  createdAt?: string;
  updatedAt?: string;
}

export interface PositionSkillPayload {
  skillId: string;
  minimumProficiency: ProficiencyLevel;
  requirementLevel?: SkillRequirementLevel;
}

export interface PositionSkillQuery {
  minProficiency?: ProficiencyLevel;
  requirementLevel?: SkillRequirementLevel;
  domain?: SkillDomain;
}

export async function getPositionSkills(
  positionId: string,
  params?: PositionSkillQuery,
): Promise<PositionSkill[]> {
  const { data } = await hrClient.get<PositionSkill[]>(`/positions/${positionId}/skills`, { params });
  return data;
}

export async function addPositionSkill(
  positionId: string,
  dto: PositionSkillPayload,
): Promise<PositionSkill> {
  const { data } = await hrClient.post<PositionSkill>(`/positions/${positionId}/skills`, dto);
  return data;
}

export async function replacePositionSkills(
  positionId: string,
  skills: PositionSkillPayload[],
): Promise<PositionSkill[]> {
  const { data } = await hrClient.put<PositionSkill[]>(`/positions/${positionId}/skills`, { skills });
  return data;
}

export async function deletePositionSkill(positionId: string, skillId: string): Promise<void> {
  await hrClient.delete(`/positions/${positionId}/skills/${skillId}`);
}

export async function getSkillsCatalog(params?: {
  search?: string;
  domain?: SkillDomain;
  category?: string;
  limit?: number;
}): Promise<{ data: SkillRef[] }> {
  const { data } = await hrClient.get<{ data: SkillRef[] }>('/skills', {
    params: { limit: 200, ...params },
  });
  return data;
}

export async function getEmployeeSkills(employeeId: string): Promise<EmployeeSkill[]> {
  const { data } = await hrClient.get<EmployeeSkill[]>(
    `/employees/${employeeId}/skills`,
  );
  return data.map((skill) => ({
    ...skill,
    proficiencyLevel: skill.proficiencyLevel ?? skill.proficiency ?? "BEGINNER",
  }));
}

export interface SkillsGapItem {
  skill: SkillRef;
  requirementLevel: SkillRequirementLevel;
  requiredProficiency: ProficiencyLevel;
  acquiredProficiency: ProficiencyLevel | null;
  gapSize: number;
  status: "MET" | "EXCEEDS" | "PARTIAL" | "MISSING";
}

export interface SkillsGapResult {
  employeeId: string;
  positionId: string;
  positionTitle: string;
  summary: {
    totalRequired: number;
    met: number;
    exceeds: number;
    partial: number;
    missing: number;
    byLevel?: Record<string, { total: number; met: number; gaps: number }>;
  };
  items: SkillsGapItem[];
}

export async function getSkillsGap(employeeId: string): Promise<SkillsGapResult | null> {
  try {
    const { data } = await hrClient.get<SkillsGapResult>(
      `/employees/${employeeId}/skills-gap`,
    );
    return data;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { status?: unknown } }).response?.status === "number" &&
      [400, 404].includes((error as { response: { status: number } }).response.status)
    ) {
      return null;
    }
    throw error;
  }
}

export interface SkillHistoryEntry {
  id: string;
  employeeId: string;
  skillId: string;
  previousLevel: string | null;
  newLevel: string | null;
  effectiveDate: string;
  source: string;
  note: string | null;
  createdAt: string;
  skill: SkillRef;
  assessedBy: { id: string; firstName: string; lastName: string } | null;
}

export async function getSkillHistory(employeeId: string): Promise<SkillHistoryEntry[]> {
  const { data } = await hrClient.get<{
    data: SkillHistoryEntry[];
    total: number;
    page: number;
    limit: number;
  }>("/skills/history", {
    params: { employeeId, limit: 200, order: "asc" },
  });
  return data.data;
}

// ── Dashboard Analytics ─────────────────────────────────────────────────────

export type TimeGranularity = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface SeriesPoint {
  label: string;
  [series: string]: string | number;
}

export interface DashboardAnalytics {
  employees: {
    total: number;
    active: number;
    onLeave: number;
    probation: number;
    terminal: number;
    newHiresOnProbation: number;
    averageAge: number | null;
    averageTenureYears: number | null;
    fullTimeRatio: number | null;
    attritionRate: number | null;
    headcountOverTime: ChartPoint[];
    newHiresTrend: ChartPoint[];
    newHiresByDepartment: SeriesPoint[];
    statusBreakdown: ChartPoint[];
    contractMix: ChartPoint[];
    ageBands: ChartPoint[];
    tenureBands: ChartPoint[];
  };
  payroll: {
    visible: boolean;
    totalCost: number | null;
    averageSalary: number | null;
    costByDepartment: ChartPoint[];
    costTrendByTeam: SeriesPoint[];
  };
  leave: {
    pendingApprovals: number;
    daysByDepartment: ChartPoint[];
    requestsByTypeOverTime: SeriesPoint[];
  };
  skills: {
    averageScore: number | null;
    skillsTracked: number;
    topSkill: string | null;
    radar: ChartPoint[];
    skillEvolution: ChartPoint[];
  };
  promotions: {
    total: number;
    byQuarter: ChartPoint[];
    byDepartment: ChartPoint[];
    recent: Array<{
      id: string;
      employeeName: string;
      departmentName: string;
      previousGrossSalary: number;
      newGrossSalary: number;
      effectiveDate: string;
    }>;
  };
  engagement: {
    implemented: false;
    metrics: [];
    trend: [];
    message: string;
  };
}

export async function getDashboardAnalytics(params?: {
  businessUnitId?: string;
  departmentId?: string;
  teamId?: string;
  granularity?: TimeGranularity;
}): Promise<DashboardAnalytics> {
  const { data } = await hrClient.get<DashboardAnalytics>('/analytics/dashboard', { params });
  return data;
}

export interface PromotionRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string;
  teamId: string | null;
  teamName: string;
  requestedById: string;
  requestedByName: string;
  currentRole: string;
  newRole: string;
  currentGrossSalary: number;
  newGrossSalary: number;
  salaryDelta: number;
  salaryDeltaPercentage: number;
  currentTeamBudget: number;
  newTeamBudget: number;
  budgetImpactPercentage: number;
  responsibilities: string[];
  status: PromotionRequestStatus;
  submittedAt: string;
}

export interface CreatePromotionRequestPayload {
  employeeId: string;
  newPositionId: string;
  newGrossSalary: number;
  responsibilities: string[];
}

export interface PromotionRequestsDashboard {
  totalRequests: number;
  averageSalaryLift: number;
  totalBudgetImpact: number;
  pendingRequests: number;
  requests: PromotionRequest[];
}

export async function createPromotionRequest(
  payload: CreatePromotionRequestPayload,
): Promise<PromotionRequest> {
  const { data } = await hrClient.post<PromotionRequest>('/promotion-requests', payload);
  return data;
}

export async function getPromotionRequests(params?: {
  year?: number;
  employeeId?: string;
  businessUnitId?: string;
  departmentId?: string;
  teamId?: string;
  status?: PromotionRequestStatus;
}): Promise<PromotionRequest[]> {
  const { data } = await hrClient.get<PromotionRequest[]>('/promotion-requests', { params });
  return data;
}

export async function getPromotionRequestsDashboard(params?: {
  year?: number;
  businessUnitId?: string;
  departmentId?: string;
  teamId?: string;
  status?: PromotionRequestStatus;
}): Promise<PromotionRequestsDashboard> {
  const { data } = await hrClient.get<PromotionRequestsDashboard>('/promotion-requests/dashboard', { params });
  return data;
}

export async function approvePromotionRequest(
  id: string,
  reviewNote?: string,
): Promise<PromotionRequest> {
  const { data } = await hrClient.patch<PromotionRequest>(`/promotion-requests/${id}/approve`, {
    reviewNote: reviewNote ?? '',
  });
  return data;
}

export async function rejectPromotionRequest(
  id: string,
  reviewNote: string,
): Promise<PromotionRequest> {
  const { data } = await hrClient.patch<PromotionRequest>(`/promotion-requests/${id}/reject`, {
    reviewNote,
  });
  return data;
}

// ── Org Chart ─────────────────────────────────────────────────────────────

export interface OrgTeam {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  businessUnitId: string;
  leadId: string | null;
  lead: OrgEmployee | null;
  leadVacant: boolean;
  projectFocus: string | null;
  employeeCount: number;
}

export interface OrgEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: { id: string; title: string } | null;
}

export interface OrgDepartment {
  id: string;
  name: string;
  code: string;
  businessUnitId: string;
  headId: string | null;
  head: OrgEmployee | null;
  teams: OrgTeam[];
}

// Backend returns OrgDepartment[] directly (not wrapped)
export async function getOrgChart(): Promise<OrgDepartment[]> {
  const { data } = await hrClient.get<OrgDepartment[]>('/org-chart');
  return data;
}

// ── Team Members ──────────────────────────────────────────────────────────

export async function getTeamMembers(teamId: string): Promise<EmployeeProfile[]> {
  const { data } = await hrClient.get<ApiPaginatedEmployees>('/employees', {
    params: { teamId, limit: 50 },
  });
  return data.data.map(normalizeEmployeeProfile);
}

// Performance Reviews

export interface CreateReviewCyclePayload {
  name: string;
  reviewType: ReviewType;
  periodStart: string;
  periodEnd: string;
  selfReviewOpensAt: string;
  selfReviewClosesAt: string;
  managerReviewDueAt: string;
}

export interface InitiateReviewCyclePayload {
  businessUnitId?: string;
  departmentId?: string;
  teamId?: string;
  reviewerOverrideId?: string;
  employeeIds?: string[];
  includeProbationEmployees?: boolean;
}

export interface SubmitSelfReviewPayload {
  environmentSatisfaction: SatisfactionLevel;
  jobSatisfaction: SatisfactionLevel;
  relationshipSatisfaction: SatisfactionLevel;
  trainingOpportunitiesTaken: number;
  workLifeBalance: SatisfactionLevel;
  selfRating: PerformanceRating;
  employeeComments?: string;
}

export interface SubmitManagerReviewPayload {
  managerRating: PerformanceRating;
  managerComments?: string;
}

export interface PerformanceReviewQuery {
  page?: number;
  limit?: number;
  cycleId?: string;
  employeeId?: string;
  reviewerId?: string;
  departmentId?: string;
  teamId?: string;
  status?: string;
  managerRating?: PerformanceRating;
  periodStart?: string;
  periodEnd?: string;
  ratingGap?: boolean;
  overdue?: boolean;
}

export async function createReviewCycle(
  payload: CreateReviewCyclePayload,
): Promise<PerformanceReviewCycleDto> {
  const { data } = await hrClient.post<PerformanceReviewCycleDto>('/performance-review-cycles', payload);
  return data;
}

export async function getReviewCycles(): Promise<PerformanceReviewCycleDto[]> {
  const { data } = await hrClient.get<PerformanceReviewCycleDto[]>('/performance-review-cycles');
  return data;
}

export async function initiateReviewCycle(
  cycleId: string,
  payload: InitiateReviewCyclePayload,
): Promise<PerformanceReviewCycleInitiationDto> {
  const { data } = await hrClient.post<PerformanceReviewCycleInitiationDto>(
    `/performance-review-cycles/${cycleId}/initiate`,
    payload,
  );
  return data;
}

export async function getReviewCycleSummary(cycleId: string): Promise<PerformanceReviewCycleSummaryDto> {
  const { data } = await hrClient.get<PerformanceReviewCycleSummaryDto>(
    `/performance-review-cycles/${cycleId}/summary`,
  );
  return data;
}

export async function closeReviewCycle(cycleId: string): Promise<PerformanceReviewCycleDto> {
  const { data } = await hrClient.post<PerformanceReviewCycleDto>(
    `/performance-review-cycles/${cycleId}/close`,
  );
  return data;
}

export async function getPerformanceReviews(
  params?: PerformanceReviewQuery,
): Promise<PerformanceReviewListDto> {
  const { data } = await hrClient.get<PerformanceReviewListDto>('/performance-reviews', { params });
  return data;
}

export async function getPerformanceReview(id: string): Promise<PerformanceReviewDto> {
  const { data } = await hrClient.get<PerformanceReviewDto>(`/performance-reviews/${id}`);
  return data;
}

export async function submitSelfReview(
  id: string,
  payload: SubmitSelfReviewPayload,
): Promise<PerformanceReviewDto> {
  const { data } = await hrClient.post<PerformanceReviewDto>(
    `/performance-reviews/${id}/self-review`,
    payload,
  );
  return data;
}

export async function submitManagerReview(
  id: string,
  payload: SubmitManagerReviewPayload,
): Promise<PerformanceReviewDto> {
  const { data } = await hrClient.post<PerformanceReviewDto>(
    `/performance-reviews/${id}/manager-review`,
    payload,
  );
  return data;
}

export async function reopenPerformanceReview(id: string, reason: string): Promise<PerformanceReviewDto> {
  const { data } = await hrClient.post<PerformanceReviewDto>(`/performance-reviews/${id}/reopen`, { reason });
  return data;
}

export async function reassignPerformanceReviewReviewer(
  id: string,
  reviewerId: string,
  reason?: string,
): Promise<PerformanceReviewDto> {
  const { data } = await hrClient.post<PerformanceReviewDto>(
    `/performance-reviews/${id}/reassign-reviewer`,
    { reviewerId, reason },
  );
  return data;
}

export async function recordPerformanceReviewSalaryFollowUp(
  id: string,
  payload: { salaryHistoryId?: string; reason: string },
): Promise<PerformanceReviewSalaryFollowUpDto> {
  const { data } = await hrClient.post<PerformanceReviewSalaryFollowUpDto>(
    `/performance-reviews/${id}/salary-follow-ups`,
    payload,
  );
  return data;
}

export async function getPerformanceReviewAudit(id: string): Promise<PerformanceReviewAuditDto[]> {
  const { data } = await hrClient.get<PerformanceReviewAuditDto[]>(`/performance-reviews/${id}/audit`);
  return data;
}

// Notifications

export interface NotificationResponse {
  id: string;
  recipientUserId: string;
  category: NotificationCategory;
  eventType: NotificationEventType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  referenceType: string | null;
  referenceId: string | null;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationListResponse {
  items: NotificationResponse[];
  nextCursor?: string;
  unreadCount: number;
}

export interface NotificationListParams {
  status?: NotificationStatus;
  category?: NotificationCategory;
  referenceType?: string;
  cursor?: string;
  limit?: number;
}

export async function listNotifications(
  params?: NotificationListParams,
): Promise<NotificationListResponse> {
  const { data } = await hrClient.get<NotificationListResponse>('/notifications', { params });
  return data;
}

export async function getUnreadCount(): Promise<{ unreadCount: number }> {
  const { data } = await hrClient.get<{ unreadCount: number }>('/notifications/unread-count');
  return data;
}

export async function markAsRead(id: string): Promise<NotificationResponse> {
  const { data } = await hrClient.patch<NotificationResponse>(`/notifications/${id}/read`);
  return data;
}

export async function markAllAsRead(
  category?: NotificationCategory,
): Promise<{ updatedCount: number }> {
  const { data } = await hrClient.patch<{ updatedCount: number }>(
    '/notifications/mark-all-read',
    category ? { category } : {},
  );
  return data;
}

export async function dismissNotification(id: string): Promise<void> {
  await hrClient.delete(`/notifications/${id}`);
}

export async function dismissAllNotifications(
  category?: NotificationCategory,
): Promise<{ updatedCount: number }> {
  const { data } = await hrClient.delete<{ updatedCount: number }>('/notifications/dismiss-all', {
    params: category ? { category } : undefined,
  });
  return data;
}
