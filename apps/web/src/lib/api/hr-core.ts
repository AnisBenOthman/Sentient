import { hrClient } from './client';

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
  deletedAt: string | null;
  department: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
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

export async function getEmployees(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  departmentId?: string;
}): Promise<PaginatedEmployees> {
  const { data } = await hrClient.get<PaginatedEmployees>('/employees', { params });
  return data;
}

export async function getEmployee(id: string): Promise<EmployeeProfile> {
  const { data } = await hrClient.get<EmployeeProfile>(`/employees/${id}`);
  return data;
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
  const { data } = await hrClient.post<EmployeeProfile>('/employees', dto);
  return data;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface Team {
  id: string;
  name: string;
  code: string;
}

export interface Position {
  id: string;
  title: string;
  level: string | null;
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

// ── Salary History ────────────────────────────────────────────────────────

export interface SalaryHistoryEntry {
  id: string;
  effectiveDate: string;
  grossBefore: number;
  grossAfter: number;
  netBefore: number;
  netAfter: number;
  reason: string;
  changedByName?: string;
}

export async function getSalaryHistory(employeeId: string): Promise<SalaryHistoryEntry[]> {
  const { data } = await hrClient.get<SalaryHistoryEntry[]>(
    `/employees/${employeeId}/salary-history`,
  );
  return data;
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
  name: string;
  defaultDaysPerYear: number;
  requiresApproval: boolean;
  accrualFrequency: string;
  color: string | null;
}

export async function getLeaveTypes(): Promise<LeaveType[]> {
  const { data } = await hrClient.get<LeaveType[]>('/leave-types');
  return data;
}

// ── Employee Skills ───────────────────────────────────────────────────────

export interface EmployeeSkill {
  id: string;
  skillId: string;
  proficiencyLevel: string;
  yearsOfExperience: number | null;
  skill: { id: string; name: string; category: string | null };
}

export async function getEmployeeSkills(employeeId: string): Promise<EmployeeSkill[]> {
  const { data } = await hrClient.get<EmployeeSkill[]>(
    `/employees/${employeeId}/skills`,
  );
  return data;
}

// ── Org Chart ─────────────────────────────────────────────────────────────

export interface OrgTeam {
  id: string;
  name: string;
  code: string;
  leadId: string | null;
  leadVacant: boolean;
  projectFocus: string | null;
  employeeCount: number;
}

export interface OrgDepartment {
  id: string;
  name: string;
  code: string;
  headId: string | null;
  teams: OrgTeam[];
}

// Backend returns OrgDepartment[] directly (not wrapped)
export async function getOrgChart(): Promise<OrgDepartment[]> {
  const { data } = await hrClient.get<OrgDepartment[]>('/org-chart');
  return data;
}

// ── Team Members ──────────────────────────────────────────────────────────

export async function getTeamMembers(teamId: string): Promise<EmployeeProfile[]> {
  const { data } = await hrClient.get<PaginatedEmployees>('/employees', {
    params: { teamId, limit: 50 },
  });
  return data.data;
}
