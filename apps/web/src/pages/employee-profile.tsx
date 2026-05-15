import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  Award,
  Briefcase,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  GraduationCap,
  Hash,
  Heart,
  Mail,
  Phone,
  Search,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  getDepartments,
  getEmployee,
  getEmployeeLeaveRequests,
  getEmployees,
  getEmployeeSkills,
  getPromotionRequests,
  getPositions,
  getSalaryHistory,
  getSkillHistory,
  getSkillsGap,
  getTeams,
  updateEmployee,
  type EmployeeProfile,
  type EmployeeSkill,
  type PromotionRequest,
  type SkillHistoryEntry,
  type SkillsGapItem,
  type SkillsGapResult,
  type UpdateEmployeeDto,
} from "@/lib/api/hr-core";
import { useAuth } from "@/components/providers/auth-provider";
import { getRoleTier } from "@/lib/auth";
import {
  PERFORMANCE_RATING_LABELS,
  useEmployeePerformanceReviews,
} from "@/lib/performance-review-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const NONE = "__none";

const CONTRACT_LABELS: Record<string, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  INTERN: "Intern",
  CONTRACTOR: "Contractor",
  FIXED_TERM: "Fixed Term",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On Leave",
  PROBATION: "Probation",
  TERMINATED: "Terminated",
  RESIGNED: "Resigned",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  ON_LEAVE: "destructive",
  PROBATION: "secondary",
  TERMINATED: "destructive",
  RESIGNED: "outline",
};

const PROFICIENCY_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  DEVELOPING: "Developing",
  INTERMEDIATE: "Intermediate",
  PROFICIENT: "Proficient",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};

const PROFICIENCY_RANK: Record<string, number> = {
  BEGINNER: 1,
  DEVELOPING: 2,
  INTERMEDIATE: 2,
  PROFICIENT: 3,
  ADVANCED: 4,
  EXPERT: 5,
};

// Proficiency rank for gap radar (matches backend: 0-3 scale)
const GAP_RANK: Record<string, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
  EXPERT: 3,
};

const DOMAIN_LABELS: Record<string, string> = {
  TECHNICAL: "Technical",
  LEADERSHIP: "Leadership",
  SOFT_SKILLS: "Soft Skills",
  DOMAIN_EXPERTISE: "Domain",
};

const REQUIREMENT_COLORS: Record<string, string> = {
  MANDATORY: "border-red-200 text-red-700 bg-red-50 dark:bg-red-900/20",
  EXPECTED: "border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-900/20",
  NICE_TO_HAVE: "border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20",
};

const REQUIREMENT_LABELS: Record<string, string> = {
  MANDATORY: "Mandatory",
  EXPECTED: "Expected",
  NICE_TO_HAVE: "Nice to Have",
};

const PROFICIENCY_COLORS: Record<string, string> = {
  BEGINNER: "#6b7280",
  DEVELOPING: "#ea580c",
  INTERMEDIATE: "#ea580c",
  PROFICIENT: "#2563eb",
  ADVANCED: "#7c3aed",
  EXPERT: "#16a34a",
};

const LEVEL_RANK_6: Record<string, number> = {
  BEGINNER: 1,
  DEVELOPING: 2,
  INTERMEDIATE: 3,
  PROFICIENT: 4,
  ADVANCED: 5,
  EXPERT: 6,
};

type MergedSkillRow = {
  id: string;
  name: string;
  domain: string | null;
  category: string | null;
  employeeRank: number;
  employeeLevelLabel: string | null;
  requiredRank: number | null;
  requiredLevelLabel: string | null;
  requirementLevel: string | null;
  status: "MET" | "EXCEEDS" | "PARTIAL" | "MISSING" | null;
};

const SKILL_STATUS_META: Record<"MET" | "EXCEEDS" | "PARTIAL" | "MISSING", {
  label: string; color: string; cls: string;
}> = {
  MET:     { label: "On Track",   color: "#10b981", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300" },
  EXCEEDS: { label: "Exceeds",    color: "#6366f1", cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300" },
  PARTIAL: { label: "Needs Work", color: "#f59e0b", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300" },
  MISSING: { label: "Missing",    color: "#ef4444", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300" },
};

const GAP_COLORS: Record<SkillsGapItem["status"], string> = {
  MET: "#16a34a",
  EXCEEDS: "#4f46e5",
  PARTIAL: "#f59e0b",
  MISSING: "#dc2626",
};

const GAP_RADAR_REQUIRED_COLOR = "#e11d48";
const GAP_RADAR_ACQUIRED_COLOR = "#059669";

type DraftProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  contractType: string;
  grossSalary: string;
  netSalary: string;
  maritalStatus: string;
  educationLevel: string;
  educationField: string;
  positionId: string;
  departmentId: string;
  teamId: string;
  managerId: string;
  salaryChangeReason: string;
  salaryChangeComment: string;
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function fullName(employee: Pick<EmployeeProfile, "firstName" | "lastName">): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMoney(value: number | null): string {
  return value == null
    ? "N/A"
    : value.toLocaleString("en-US", { style: "currency", currency: "DZD" });
}

function formatPercent(value: number | null): string {
  return value == null ? "N/A" : `${value.toFixed(1)}%`;
}

function normalizeSelect(value: string | null | undefined): string {
  return value && value.length > 0 ? value : NONE;
}

function denormalizeSelect(value: string): string | undefined {
  return value === NONE ? undefined : value;
}

function buildDraft(emp: EmployeeProfile): DraftProfile {
  return {
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email,
    phone: emp.phone ?? "",
    dateOfBirth: dateInputValue(emp.dateOfBirth),
    contractType: emp.contractType,
    grossSalary: emp.grossSalary == null ? "" : String(emp.grossSalary),
    netSalary: emp.netSalary == null ? "" : String(emp.netSalary),
    maritalStatus: normalizeSelect(emp.maritalStatus),
    educationLevel: normalizeSelect(emp.educationLevel),
    educationField: emp.educationField ?? "",
    positionId: normalizeSelect(emp.positionId ?? emp.position?.id),
    departmentId: normalizeSelect(emp.departmentId ?? emp.department?.id),
    teamId: normalizeSelect(emp.teamId ?? emp.team?.id),
    managerId: normalizeSelect(emp.managerId ?? emp.manager?.id),
    salaryChangeReason: "ANNUAL_REVIEW",
    salaryChangeComment: "",
  };
}

function draftToUpdate(draft: DraftProfile, emp: EmployeeProfile): UpdateEmployeeDto {
  const dto: UpdateEmployeeDto = {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim() || undefined,
    dateOfBirth: draft.dateOfBirth || undefined,
    contractType: draft.contractType,
    maritalStatus: denormalizeSelect(draft.maritalStatus),
    educationLevel: denormalizeSelect(draft.educationLevel),
    educationField: draft.educationField.trim() || undefined,
    positionId: denormalizeSelect(draft.positionId),
    departmentId: denormalizeSelect(draft.departmentId),
    teamId: denormalizeSelect(draft.teamId),
    managerId: denormalizeSelect(draft.managerId),
  };

  const grossChanged = draft.grossSalary !== "" && Number(draft.grossSalary) !== emp.grossSalary;
  const netChanged = draft.netSalary !== "" && Number(draft.netSalary) !== emp.netSalary;
  if (grossChanged) {
    dto.grossSalary = draft.grossSalary;
    dto.salaryChangeReason = draft.salaryChangeReason;
    if (draft.salaryChangeReason === "OTHER") {
      dto.salaryChangeComment = draft.salaryChangeComment.trim();
    }
  }
  if (netChanged) {
    dto.netSalary = draft.netSalary;
  }
  return dto;
}

function InfoRow({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="font-medium" data-testid={testId}>
        {value ?? "N/A"}
      </p>
    </div>
  );
}

function EditField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </Label>
      {children}
    </div>
  );
}

function skillLevel(skill: EmployeeSkill): string {
  return skill.proficiencyLevel ?? skill.proficiency ?? "BEGINNER";
}

function levelLabel(level: string | null): string {
  return level ? PROFICIENCY_LABELS[level] ?? level : "Missing";
}

function levelRank(level: string | null): number {
  return level ? PROFICIENCY_RANK[level] ?? 0 : 0;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function SalaryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-white shadow-xl p-3 text-sm dark:bg-gray-900 dark:border-gray-700">
      <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto pl-4 font-bold tabular-nums">
            {entry.value.toLocaleString()} DZD
          </span>
        </div>
      ))}
    </div>
  );
}

export default function EmployeeProfile({ employeeId }: { employeeId?: string }) {
  const params = useParams<{ id: string }>();
  const id = employeeId ?? params.id ?? "";
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<DraftProfile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: emp, isLoading: loadingEmp } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployee(id),
    enabled: !!id,
  });

  const { data: skills = [] } = useQuery({
    queryKey: ["employee-skills", id],
    queryFn: () => getEmployeeSkills(id),
    enabled: !!id,
  });

  const { data: skillHistory = [] } = useQuery({
    queryKey: ["skill-history", id],
    queryFn: () => getSkillHistory(id),
    enabled: !!id,
  });

  const { data: skillsGap } = useQuery({
    queryKey: ["skills-gap", id],
    queryFn: () => getSkillsGap(id),
    enabled: !!id,
  });

  const { data: salaryHistory = [] } = useQuery({
    queryKey: ["salary-history", id],
    queryFn: () => getSalaryHistory(id),
    enabled: !!id,
    retry: false,
  });

  const { data: promotionRequests = [], isLoading: loadingPromotions } = useQuery({
    queryKey: ["promotion-requests", "employee", id],
    queryFn: () => getPromotionRequests({ employeeId: id }),
    enabled: !!id,
    retry: false,
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["employee-leaves", id],
    queryFn: () => getEmployeeLeaveRequests(id),
    enabled: !!id,
  });

  const { data: employeesResult } = useQuery({
    queryKey: ["employees", { limit: 500 }],
    queryFn: () => getEmployees({ limit: 500 }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: getTeams,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositions,
  });

  const updateMutation = useMutation({
    mutationFn: ({ employeeId, payload }: { employeeId: string; payload: UpdateEmployeeDto }) =>
      updateEmployee(employeeId, payload),
    onSuccess: async () => {
      setEditMode(false);
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employee", id] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
        queryClient.invalidateQueries({ queryKey: ["salary-history", id] }),
      ]);
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
          ? (error as { response: { data: { message: string } } }).response.data.message
          : "Could not save employee changes.";
      setFormError(message);
    },
  });

  const allEmployees = employeesResult?.data ?? [];
  const directReports = useMemo(
    () => allEmployees.filter((employee) => (employee.managerId ?? employee.manager?.id) === id),
    [allEmployees, id],
  );

  const reviews = useEmployeePerformanceReviews(id);
  const canEditProfile = user ? getRoleTier(user) === "hr_admin" : false;

  if (loadingEmp) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center">
        <h2 className="mb-2 text-2xl font-bold">Employee Not Found</h2>
        <p className="mb-4 text-muted-foreground">
          The requested employee could not be found.
        </p>
        <Link href="/employees">
          <Button>Back to Directory</Button>
        </Link>
      </div>
    );
  }

  const employee = emp;
  const currentDraft = draft ?? buildDraft(employee);
  const name = fullName(employee);
  const profileDepartment = employee.department?.id
    ? departments.find((department) => department.id === employee.department?.id)
    : undefined;
  const profileBusinessUnitName =
    employee.team?.businessUnit?.name ??
    employee.department?.businessUnit?.name ??
    profileDepartment?.businessUnit?.name ??
    "Unassigned";
  const draftDepartment = currentDraft.departmentId !== NONE
    ? departments.find((department) => department.id === currentDraft.departmentId)
    : undefined;
  const draftBusinessUnitName = draftDepartment?.businessUnit?.name ?? "Unassigned";
  const profileOrgPath = [
    profileBusinessUnitName !== "Unassigned" ? profileBusinessUnitName : undefined,
    employee.department?.name,
  ].filter(Boolean).join(" / ");
  const sortedSalaryHistory = [...salaryHistory].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate),
  );
  const salaryChartData = sortedSalaryHistory.map((entry) => ({
    date: entry.effectiveDate.slice(0, 10),
    gross: entry.grossAfter,
    net: entry.netAfter,
  }));

  function startEditing(): void {
    setDraft(buildDraft(employee));
    setFormError(null);
    setEditMode(true);
  }

  function cancelEditing(): void {
    setDraft(buildDraft(employee));
    setFormError(null);
    setEditMode(false);
  }

  function saveEditing(): void {
    if (!draft) return;
    updateMutation.mutate({ employeeId: employee.id, payload: draftToUpdate(draft, employee) });
  }

  function patchDraft(patch: Partial<DraftProfile>): void {
    setDraft((prev) => ({ ...(prev ?? buildDraft(employee)), ...patch }));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/employees">
        <Button variant="ghost" className="gap-2 pl-0 hover:bg-transparent" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Button>
      </Link>

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
            <AvatarFallback className="bg-primary/10 text-3xl text-primary">
              {getInitials(emp.firstName, emp.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-employee-name">
              {name}
            </h1>
            <p className="mt-1 text-xl text-muted-foreground">{emp.position?.title ?? "N/A"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={emp.employmentStatus} />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                {profileOrgPath || "Unassigned"}
              </div>
              {emp.team && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {emp.team.name}
                </div>
              )}
            </div>
          </div>
        </div>

        {canEditProfile && (
          <div className="flex gap-3">
            {editMode ? (
              <>
                <Button variant="outline" className="gap-2" onClick={cancelEditing}>
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button className="gap-2" onClick={saveEditing} disabled={updateMutation.isPending}>
                  <Check className="h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" className="gap-2" onClick={startEditing} data-testid="button-edit-profile">
                <Check className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>
        )}
      </div>

      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <Tabs defaultValue="details" className="pt-2">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="leave-history">Leave History {leaveRequests.length > 0 ? `(${leaveRequests.length})` : ""}</TabsTrigger>
          <TabsTrigger value="skills">Skills {skills.length > 0 ? `(${skills.length})` : ""}</TabsTrigger>
          <TabsTrigger value="promotions">Promotion History {promotionRequests.length > 0 ? `(${promotionRequests.length})` : ""}</TabsTrigger>
          <TabsTrigger value="performance">Performance {reviews.length > 0 ? `(${reviews.length})` : ""}</TabsTrigger>
          {salaryHistory.length > 0 && <TabsTrigger value="salary">Salary History</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-6 md:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-indigo-500" />
                    <CardTitle>Professional Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {editMode ? (
                    <>
                      <EditField icon={UserCheck} label="First Name">
                        <Input value={currentDraft.firstName} onChange={(event) => patchDraft({ firstName: event.target.value })} />
                      </EditField>
                      <EditField icon={UserCheck} label="Last Name">
                        <Input value={currentDraft.lastName} onChange={(event) => patchDraft({ lastName: event.target.value })} />
                      </EditField>
                      <EditField icon={Briefcase} label="Position">
                        <Select value={currentDraft.positionId} onValueChange={(value) => patchDraft({ positionId: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Unassigned</SelectItem>
                            {positions.map((position) => (
                              <SelectItem key={position.id} value={position.id}>{position.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={Award} label="Contract Type">
                        <Select value={currentDraft.contractType} onValueChange={(value) => patchDraft({ contractType: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(CONTRACT_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={Building} label="Business Unit">
                        <Input value={draftBusinessUnitName} disabled />
                      </EditField>
                      <EditField icon={Building} label="Department">
                        <Select value={currentDraft.departmentId} onValueChange={(value) => patchDraft({ departmentId: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Unassigned</SelectItem>
                            {departments.map((department) => (
                              <SelectItem key={department.id} value={department.id}>
                                {department.businessUnit?.name ? `${department.businessUnit.name} / ${department.name}` : department.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={Users} label="Team">
                        <Select value={currentDraft.teamId} onValueChange={(value) => patchDraft({ teamId: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Unassigned</SelectItem>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={UserCheck} label="Manager">
                        <Select value={currentDraft.managerId} onValueChange={(value) => patchDraft({ managerId: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Unassigned</SelectItem>
                            {allEmployees.filter((employee) => employee.id !== emp.id).map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>{fullName(employee)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                    </>
                  ) : (
                    <>
                      <InfoRow icon={Hash} label="Employee Code" value={<span className="font-mono">{emp.employeeCode}</span>} />
                      <InfoRow icon={UserCheck} label="Full Name" value={name} testId="text-name" />
                      <InfoRow icon={Briefcase} label="Job Title" value={emp.position?.title} testId="text-role" />
                      <InfoRow icon={Award} label="Contract Type" value={CONTRACT_LABELS[emp.contractType] ?? emp.contractType} />
                      <InfoRow icon={Building} label="Business Unit" value={profileBusinessUnitName} />
                      <InfoRow icon={Building} label="Department" value={emp.department?.name} />
                      <InfoRow icon={Users} label="Team" value={emp.team?.name} />
                      <InfoRow icon={UserCheck} label="Manager" value={emp.manager ? fullName(emp.manager) : "N/A"} />
                      <InfoRow icon={Calendar} label="Hire Date" value={formatDate(emp.hireDate)} />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <CardTitle>Contact and Personal Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {editMode ? (
                    <>
                      <EditField icon={Mail} label="Email">
                        <Input type="email" value={currentDraft.email} onChange={(event) => patchDraft({ email: event.target.value })} />
                      </EditField>
                      <EditField icon={Phone} label="Phone">
                        <Input value={currentDraft.phone} onChange={(event) => patchDraft({ phone: event.target.value })} />
                      </EditField>
                      <EditField icon={Calendar} label="Date of Birth">
                        <Input type="date" value={currentDraft.dateOfBirth} onChange={(event) => patchDraft({ dateOfBirth: event.target.value })} />
                      </EditField>
                      <EditField icon={Heart} label="Marital Status">
                        <Select value={currentDraft.maritalStatus} onValueChange={(value) => patchDraft({ maritalStatus: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Unspecified</SelectItem>
                            <SelectItem value="SINGLE">Single</SelectItem>
                            <SelectItem value="MARRIED">Married</SelectItem>
                            <SelectItem value="DIVORCED">Divorced</SelectItem>
                            <SelectItem value="WIDOWED">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={GraduationCap} label="Education Level">
                        <Select value={currentDraft.educationLevel} onValueChange={(value) => patchDraft({ educationLevel: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Unspecified</SelectItem>
                            <SelectItem value="HIGH_SCHOOL">High School</SelectItem>
                            <SelectItem value="BACHELOR">Bachelor</SelectItem>
                            <SelectItem value="MASTER">Master</SelectItem>
                            <SelectItem value="PHD">PhD</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={GraduationCap} label="Education Field">
                        <Input value={currentDraft.educationField} onChange={(event) => patchDraft({ educationField: event.target.value })} />
                      </EditField>
                    </>
                  ) : (
                    <>
                      <InfoRow icon={Mail} label="Email" value={emp.email} />
                      <InfoRow icon={Phone} label="Phone" value={emp.phone} />
                      <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(emp.dateOfBirth)} />
                      <InfoRow icon={Heart} label="Marital Status" value={emp.maritalStatus} />
                      <InfoRow icon={GraduationCap} label="Education Level" value={emp.educationLevel} />
                      <InfoRow icon={GraduationCap} label="Education Field" value={emp.educationField} />
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <CardTitle>Compensation</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editMode ? (
                    <>
                      <EditField icon={DollarSign} label="Gross Salary">
                        <Input value={currentDraft.grossSalary} onChange={(event) => patchDraft({ grossSalary: event.target.value })} />
                      </EditField>
                      <EditField icon={DollarSign} label="Net Salary">
                        <Input value={currentDraft.netSalary} onChange={(event) => patchDraft({ netSalary: event.target.value })} />
                      </EditField>
                      <EditField icon={TrendingUp} label="Salary Change Reason">
                        <Select value={currentDraft.salaryChangeReason} onValueChange={(value) => patchDraft({ salaryChangeReason: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PROMOTION">Promotion</SelectItem>
                            <SelectItem value="ANNUAL_REVIEW">Annual Review</SelectItem>
                            <SelectItem value="NEW_FUNCTION">New Function</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </EditField>
                      {currentDraft.salaryChangeReason === "OTHER" && (
                        <EditField icon={TrendingUp} label="Reason Comment">
                          <Input value={currentDraft.salaryChangeComment} onChange={(event) => patchDraft({ salaryChangeComment: event.target.value })} />
                        </EditField>
                      )}
                    </>
                  ) : (
                    <>
                      <InfoRow icon={DollarSign} label="Gross Salary" value={formatMoney(emp.grossSalary)} />
                      <InfoRow icon={DollarSign} label="Net Salary" value={formatMoney(emp.netSalary)} />
                    </>
                  )}
                </CardContent>
              </Card>

              <DirectReportsCard directReports={directReports} />
              <QuickStatsCard leaveCount={leaveRequests.length} skillsCount={skills.length} promotionCount={promotionRequests.length} salaryCount={salaryHistory.length} reviewCount={reviews.length} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leave-history" className="mt-6">
          <LeaveHistoryCard leaveRequests={leaveRequests} />
        </TabsContent>

        <TabsContent value="skills" className="mt-6 space-y-6">
          <GapRadarCard gap={skillsGap ?? null} />
          <SkillsGridCard skills={skills} gap={skillsGap ?? null} />
          <SkillEvolutionCard history={skillHistory} />
        </TabsContent>

        <TabsContent value="promotions" className="mt-6">
          <PromotionHistoryCard isLoading={loadingPromotions} promotionRequests={promotionRequests} />
        </TabsContent>

        <TabsContent value="performance" className="mt-6 space-y-6">
          <RecentPerformanceCard employeeId={id} />
          <EngagementHistoryCard employeeId={id} />
        </TabsContent>

        {salaryHistory.length > 0 && (
          <TabsContent value="salary" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Salary History</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Legend chips */}
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    Gross salary
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Net salary
                  </div>
                </div>

                <div className="mb-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salaryChartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                      <defs>
                        <linearGradient id="gradGross" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="0"
                        stroke="#f0f0f0"
                        vertical={false}
                        strokeOpacity={0.8}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        dy={6}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1_000
                            ? `${(v / 1_000).toFixed(0)}k`
                            : String(v)
                        }
                        width={48}
                      />
                      <Tooltip content={<SalaryTooltip />} cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }} />
                      <Area
                        type="monotone"
                        dataKey="gross"
                        name="Gross"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#gradGross)"
                        dot={false}
                        activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="net"
                        name="Net"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#gradNet)"
                        dot={false}
                        activeDot={{ r: 5, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Gross Before</TableHead>
                      <TableHead>Gross After</TableHead>
                      <TableHead>Net Before</TableHead>
                      <TableHead>Net After</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSalaryHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.effectiveDate)}</TableCell>
                        <TableCell>{entry.grossBefore?.toLocaleString() ?? "N/A"}</TableCell>
                        <TableCell className="font-semibold">{entry.grossAfter?.toLocaleString() ?? "N/A"}</TableCell>
                        <TableCell>{entry.netBefore?.toLocaleString() ?? "N/A"}</TableCell>
                        <TableCell className="font-semibold">{entry.netAfter?.toLocaleString() ?? "N/A"}</TableCell>
                        <TableCell>{entry.reason ?? "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function DirectReportsCard({ directReports }: { directReports: EmployeeProfile[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          <CardTitle>Direct Reports</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {directReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No direct reports.</p>
        ) : (
          <div className="space-y-3">
            {directReports.map((employee) => (
              <Link key={employee.id} href={`/employees/${employee.id}`}>
                <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{getInitials(employee.firstName, employee.lastName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{fullName(employee)}</p>
                    <p className="truncate text-xs text-muted-foreground">{employee.position?.title ?? employee.email}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickStatsCard({
  leaveCount,
  skillsCount,
  promotionCount,
  salaryCount,
  reviewCount,
}: {
  leaveCount: number;
  skillsCount: number;
  promotionCount: number;
  salaryCount: number;
  reviewCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Quick Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <StatLine label="Leave requests" value={leaveCount} />
        <StatLine label="Skills" value={skillsCount} />
        <StatLine label="Promotion requests" value={promotionCount} />
        <StatLine label="Salary changes" value={salaryCount} />
        <StatLine label="Performance reviews" value={reviewCount} />
      </CardContent>
    </Card>
  );
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function PromotionStatusBadge({ status }: { status: PromotionRequest["status"] }) {
  const classes: Record<PromotionRequest["status"], string> = {
    PENDING: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    REJECTED: "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  };

  return (
    <Badge variant="outline" className={classes[status] ?? "capitalize"}>
      {status.toLowerCase()}
    </Badge>
  );
}

function PromotionHistoryCard({
  isLoading,
  promotionRequests,
}: {
  isLoading: boolean;
  promotionRequests: PromotionRequest[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-amber-500" />
          <CardTitle>Promotion History</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading promotion history...</p>
        ) : promotionRequests.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No promotion requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Role Change</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Salary Change</TableHead>
                  <TableHead className="text-right">Budget Impact</TableHead>
                  <TableHead>Requested By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotionRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{formatDate(request.submittedAt)}</TableCell>
                    <TableCell>
                      <div className="max-w-[260px] text-sm">
                        <span>{request.currentRole}</span>
                        <span className="px-1.5 text-muted-foreground">to</span>
                        <span className="font-medium text-blue-700 dark:text-blue-400">{request.newRole}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PromotionStatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">{formatMoney(request.salaryDelta)}</div>
                      <div className="text-xs text-muted-foreground">{formatPercent(request.salaryDeltaPercentage)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>{formatMoney(request.newTeamBudget - request.currentTeamBudget)}</div>
                      <div className="text-xs text-muted-foreground">{formatPercent(request.budgetImpactPercentage)}</div>
                    </TableCell>
                    <TableCell>{request.requestedByName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type LeaveRequestItem = Awaited<ReturnType<typeof getEmployeeLeaveRequests>>[number];

function LeaveHistoryCard({ leaveRequests }: { leaveRequests: LeaveRequestItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave History</CardTitle>
      </CardHeader>
      <CardContent>
        {leaveRequests.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No leave requests found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.leaveType?.name ?? request.leaveTypeId}</TableCell>
                  <TableCell>{formatDate(request.startDate)}</TableCell>
                  <TableCell>{formatDate(request.endDate)}</TableCell>
                  <TableCell>{request.totalDays}</TableCell>
                  <TableCell><Badge variant="outline">{request.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function GapRadarCard({ gap }: { gap: SkillsGapResult | null }) {
  const domainRadarGroups = useMemo(() => {
    if (!gap || gap.items.length === 0) return [];
    const byDomain = new Map<string, Array<{
      skill: string;
      required: number;
      acquired: number;
      gapSize: number;
      status: SkillsGapItem["status"];
      isPadding: boolean;
    }>>();

    for (const item of gap.items) {
      const domain = item.skill.domain ?? "DOMAIN_EXPERTISE";
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      const entry = byDomain.get(domain)!;
      const required = GAP_RANK[item.requiredProficiency] ?? 0;
      const acquired = item.acquiredProficiency != null ? (GAP_RANK[item.acquiredProficiency] ?? 0) : 0;
      entry.push({
        skill: item.skill.name,
        required,
        acquired,
        gapSize: Math.max(required - acquired, 0),
        status: item.status,
        isPadding: false,
      });
    }

    return Array.from(byDomain.entries()).map(([domain, rows]) => {
      const chartRows = [...rows];
      while (chartRows.length < 3) {
        chartRows.push({
          skill: `Axis ${chartRows.length + 1}`,
          required: 0,
          acquired: 0,
          gapSize: 0,
          status: "MET",
          isPadding: true,
        });
      }

      const requiredAverage = rows.reduce((sum, row) => sum + row.required, 0) / rows.length;
      const acquiredAverage = rows.reduce((sum, row) => sum + row.acquired, 0) / rows.length;
      const gapCount = rows.filter((row) => row.gapSize > 0).length;

      return {
        domain,
        label: DOMAIN_LABELS[domain] ?? domain,
        rows,
        chartRows,
        requiredAverage,
        acquiredAverage,
        gapCount,
      };
    });
  }, [gap]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-indigo-500" />
          <CardTitle>Skills Gap Radar</CardTitle>
          {gap?.positionTitle && (
            <span className="ml-auto text-xs text-muted-foreground">vs. {gap.positionTitle}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!gap || domainRadarGroups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {!gap
              ? "Assign a position to this employee to see the skills gap radar."
              : "No required skills with domain classification yet."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GAP_RADAR_REQUIRED_COLOR }} />
                Required level
              </span>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GAP_RADAR_ACQUIRED_COLOR }} />
                Employee level
              </span>
              <span className="ml-auto text-xs text-muted-foreground">Scale: Beginner 0 - Expert 3</span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {domainRadarGroups.map((group) => (
                <div key={group.domain} className="rounded-xl border bg-white p-4 dark:bg-background">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{group.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.rows.length} skill{group.rows.length > 1 ? "s" : ""} measured in this domain
                      </p>
                    </div>
                    <Badge variant={group.gapCount > 0 ? "destructive" : "secondary"}>
                      {group.gapCount > 0 ? `${group.gapCount} gap${group.gapCount > 1 ? "s" : ""}` : "Covered"}
                    </Badge>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        data={group.chartRows}
                        cx="50%"
                        cy="50%"
                        outerRadius="66%"
                        margin={{ top: 18, right: 56, bottom: 10, left: 56 }}
                      >
                        <PolarGrid stroke="#d1d5db" />
                        <PolarAngleAxis
                          dataKey="skill"
                          tick={{ fontSize: 11, fill: "#111827" }}
                          tickFormatter={(value: string, index: number) => group.chartRows[index]?.isPadding ? "" : value}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 3]}
                          tickCount={4}
                          tick={{ fontSize: 10, fill: "#6b7280" }}
                          axisLine={false}
                        />
                        <Radar
                          name="Required level"
                          dataKey="required"
                          stroke={GAP_RADAR_REQUIRED_COLOR}
                          fill={GAP_RADAR_REQUIRED_COLOR}
                          fillOpacity={0.14}
                          strokeWidth={3}
                          isAnimationActive={false}
                        />
                        <Radar
                          name="Employee level"
                          dataKey="acquired"
                          stroke={GAP_RADAR_ACQUIRED_COLOR}
                          fill={GAP_RADAR_ACQUIRED_COLOR}
                          fillOpacity={0.38}
                          strokeWidth={3}
                          isAnimationActive={false}
                        />
                        <Legend
                          iconType="circle"
                          formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            `${value.toFixed(1)}/3`,
                            name,
                          ]}
                          labelFormatter={(label: string) => label.startsWith("Axis ") ? "" : label}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {group.rows.map((row) => (
                      <div key={row.skill} className="grid gap-2 rounded-lg bg-muted/30 p-2 sm:grid-cols-[1fr_90px_90px_80px] sm:items-center">
                        <p className="truncate text-sm font-medium">{row.skill}</p>
                        <span className="text-xs text-muted-foreground">Req. {row.required}/3</span>
                        <span className="text-xs text-muted-foreground">Emp. {row.acquired}/3</span>
                        <Badge variant={row.gapSize > 0 ? "destructive" : "secondary"} className="w-fit">
                          {row.gapSize > 0 ? `${row.gapSize} gap` : "OK"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkillLevelPips({ rank, max = 6, color }: { rank: number; max?: number; color?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full transition-colors"
          style={{ backgroundColor: i < rank ? (color ?? "#6366f1") : "#e2e8f0" }}
        />
      ))}
    </div>
  );
}

function SkillsGridCard({ skills, gap }: { skills: EmployeeSkill[]; gap: SkillsGapResult | null }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "MET" | "EXCEEDS" | "PARTIAL" | "MISSING" | "GAPS">("ALL");
  const [domainFilter, setDomainFilter] = useState("ALL");

  const merged = useMemo((): MergedSkillRow[] => {
    const gapMap = new Map<string, SkillsGapItem>();
    if (gap) {
      for (const item of gap.items) {
        gapMap.set(item.skill.id, item);
      }
    }

    const rows: MergedSkillRow[] = skills.map((s) => {
      const empLevel = skillLevel(s);
      const gapItem = gapMap.get(s.skill.id);
      const reqLevel = gapItem?.requiredProficiency ?? null;
      return {
        id: s.id,
        name: s.skill.name,
        domain: s.skill.domain ?? null,
        category: s.skill.category ?? null,
        employeeRank: LEVEL_RANK_6[empLevel] ?? 1,
        employeeLevelLabel: PROFICIENCY_LABELS[empLevel] ?? empLevel,
        requiredRank: reqLevel ? (LEVEL_RANK_6[reqLevel] ?? null) : null,
        requiredLevelLabel: reqLevel ? (PROFICIENCY_LABELS[reqLevel] ?? reqLevel) : null,
        requirementLevel: gapItem?.requirementLevel ?? null,
        status: gapItem?.status ?? null,
      };
    });

    const employeeSkillIds = new Set(skills.map((s) => s.skill.id));
    if (gap) {
      for (const item of gap.items) {
        if (!employeeSkillIds.has(item.skill.id) && item.status === "MISSING") {
          const reqLevel = item.requiredProficiency;
          rows.push({
            id: item.skill.id,
            name: item.skill.name,
            domain: item.skill.domain ?? null,
            category: item.skill.category ?? null,
            employeeRank: 0,
            employeeLevelLabel: null,
            requiredRank: reqLevel ? (LEVEL_RANK_6[reqLevel] ?? null) : null,
            requiredLevelLabel: reqLevel ? (PROFICIENCY_LABELS[reqLevel] ?? reqLevel) : null,
            requirementLevel: item.requirementLevel,
            status: "MISSING",
          });
        }
      }
    }
    return rows;
  }, [skills, gap]);

  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const row of merged) {
      if (row.domain) set.add(row.domain);
    }
    return Array.from(set);
  }, [merged]);

  const statusCounts = useMemo(() => {
    const counts: Record<"ALL" | "MET" | "EXCEEDS" | "PARTIAL" | "MISSING" | "GAPS", number> = {
      ALL: merged.length, MET: 0, EXCEEDS: 0, PARTIAL: 0, MISSING: 0, GAPS: 0,
    };
    for (const row of merged) {
      if (row.status === "MET") counts.MET++;
      else if (row.status === "EXCEEDS") counts.EXCEEDS++;
      else if (row.status === "PARTIAL") { counts.PARTIAL++; counts.GAPS++; }
      else if (row.status === "MISSING") { counts.MISSING++; counts.GAPS++; }
    }
    return counts;
  }, [merged]);

  const filtered = useMemo(() => merged.filter((row) => {
    if (search && !row.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (domainFilter !== "ALL" && row.domain !== domainFilter) return false;
    if (statusFilter === "ALL") return true;
    if (statusFilter === "GAPS") return row.status === "PARTIAL" || row.status === "MISSING";
    return row.status === statusFilter;
  }), [merged, search, statusFilter, domainFilter]);

  if (merged.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <CardTitle>Skills</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">No skills recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  const CHIP_META: Record<"ALL" | "MET" | "EXCEEDS" | "PARTIAL" | "MISSING" | "GAPS", { label: string; color: string; activeClass: string }> = {
    ALL:     { label: "All",        color: "#6b7280", activeClass: "border-gray-400 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200" },
    GAPS:    { label: "Gaps",       color: "#ef4444", activeClass: "border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
    MET:     { label: "On Track",   color: "#10b981", activeClass: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" },
    EXCEEDS: { label: "Exceeds",    color: "#6366f1", activeClass: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" },
    PARTIAL: { label: "Needs Work", color: "#f59e0b", activeClass: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" },
    MISSING: { label: "Missing",    color: "#ef4444", activeClass: "border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <CardTitle>Skills</CardTitle>
          <span className="text-xs font-normal text-muted-foreground">
            {merged.length} skill{merged.length !== 1 ? "s" : ""}
            {gap?.positionTitle ? ` · vs. ${gap.positionTitle}` : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search + Domain filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search skills…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
          {domains.length > 0 && (
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="All Domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Domains</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>{DOMAIN_LABELS[d] ?? d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", "GAPS", "MET", "EXCEEDS", "PARTIAL", "MISSING"] as const).map((s) => {
            const meta = CHIP_META[s];
            const count = statusCounts[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
                  active
                    ? meta.activeClass
                    : "border-gray-200 bg-white text-muted-foreground hover:border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                }`}
              >
                {meta.label}
                <span className="min-w-[14px] rounded-full bg-current/10 px-1 text-center tabular-nums opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No skills match your filters.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => {
              const statusMeta = row.status ? SKILL_STATUS_META[row.status] : null;
              const borderColor = statusMeta?.color ?? "#e2e8f0";
              const empPipColor = statusMeta?.color ?? "#6366f1";

              return (
                <div
                  key={row.id}
                  className="rounded-xl border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md"
                  style={{ borderLeftWidth: "4px", borderLeftColor: borderColor }}
                >
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-snug">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.domain ? (DOMAIN_LABELS[row.domain] ?? row.domain) : (row.category ?? "General")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {statusMeta && (
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${statusMeta.cls}`}>
                          {statusMeta.label}
                        </span>
                      )}
                      {row.requirementLevel && (
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${REQUIREMENT_COLORS[row.requirementLevel] ?? ""}`}>
                          {REQUIREMENT_LABELS[row.requirementLevel] ?? row.requirementLevel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level comparison */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mine</span>
                      <SkillLevelPips rank={row.employeeRank} color={empPipColor} />
                      <span className="ml-auto shrink-0 text-[11px] font-medium">
                        {row.employeeLevelLabel ?? <span className="text-muted-foreground italic">None</span>}
                      </span>
                    </div>
                    {row.requiredRank != null && (
                      <div className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Target</span>
                        <SkillLevelPips rank={row.requiredRank} color="#94a3b8" />
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {row.requiredLevelLabel ?? "N/A"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkillEvolutionCard({ history }: { history: SkillHistoryEntry[] }) {
  const sorted = useMemo(
    () => [...history].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)),
    [history],
  );

  const improvements = useMemo(
    () => history.filter((e) => {
      const prevRank = e.previousLevel ? (LEVEL_RANK_6[e.previousLevel] ?? 0) : 0;
      const newRank = e.newLevel ? (LEVEL_RANK_6[e.newLevel] ?? 0) : 0;
      return newRank > prevRank;
    }).length,
    [history],
  );

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <CardTitle>Skill Evolution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">No skill history recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          <CardTitle>Skill Evolution</CardTitle>
          <span className="text-xs font-normal text-muted-foreground">{history.length} event{history.length !== 1 ? "s" : ""}</span>
          {improvements > 0 && (
            <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              +{improvements} improvement{improvements !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6">
          <div className="absolute bottom-4 left-2 top-0 w-px bg-border" />
          <div className="space-y-4">
            {sorted.map((entry, index) => {
              const prevRank = entry.previousLevel ? (LEVEL_RANK_6[entry.previousLevel] ?? 0) : 0;
              const newRank = entry.newLevel ? (LEVEL_RANK_6[entry.newLevel] ?? 0) : 0;
              const delta = newRank - prevRank;
              const dotColor = delta > 0 ? "#10b981" : delta < 0 ? "#ef4444" : "#94a3b8";
              const levelColor = entry.newLevel ? (PROFICIENCY_COLORS[entry.newLevel] ?? "#6366f1") : "#6366f1";
              const assessorName = entry.assessedBy
                ? `${entry.assessedBy.firstName} ${entry.assessedBy.lastName}`
                : null;

              return (
                <div key={`${entry.id}-${index}`} className="relative">
                  <div
                    className="absolute -left-6 mt-1.5 h-3 w-3 rounded-full border-2 border-background shadow-sm"
                    style={{ backgroundColor: dotColor }}
                  />
                  <div className="rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{entry.skill.name}</p>
                        {entry.skill.domain && (
                          <p className="text-xs text-muted-foreground">
                            {DOMAIN_LABELS[entry.skill.domain] ?? entry.skill.domain}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(entry.effectiveDate)}</span>
                        {delta !== 0 && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums"
                            style={{
                              backgroundColor: delta > 0 ? "#d1fae5" : "#fee2e2",
                              color: delta > 0 ? "#065f46" : "#991b1b",
                            }}
                          >
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-3">
                      {entry.previousLevel && (
                        <>
                          <div className="flex flex-col items-start gap-1">
                            <SkillLevelPips rank={prevRank} color="#94a3b8" />
                            <span className="text-[10px] text-muted-foreground">
                              {PROFICIENCY_LABELS[entry.previousLevel] ?? entry.previousLevel}
                            </span>
                          </div>
                          <span className="text-muted-foreground">→</span>
                        </>
                      )}
                      {entry.newLevel && (
                        <div className="flex flex-col items-start gap-1">
                          <SkillLevelPips rank={newRank} color={levelColor} />
                          <span className="text-[10px] font-medium">
                            {PROFICIENCY_LABELS[entry.newLevel] ?? entry.newLevel}
                          </span>
                        </div>
                      )}
                      {assessorName && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          by {assessorName}
                        </span>
                      )}
                      {entry.note && (
                        <span className="w-full text-[11px] italic text-muted-foreground">{entry.note}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentPerformanceCard({ employeeId }: { employeeId: string }) {
  const reviews = useEmployeePerformanceReviews(employeeId);
  const recent = reviews.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Performance</CardTitle>
          <Link href="/performance-reviews" className="text-xs text-primary hover:underline">View all</Link>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No performance reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {recent.map((review) => (
              <Link key={review.id} href="/performance-reviews">
                <div className="rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">{review.reviewDate}</span>
                    <span className="text-xs text-muted-foreground">by {review.reviewerName}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span><span className="text-muted-foreground">Manager: </span>{review.managerRating} - {PERFORMANCE_RATING_LABELS[review.managerRating]}</span>
                    <span><span className="text-muted-foreground">Self: </span>{review.selfRating} - {PERFORMANCE_RATING_LABELS[review.selfRating]}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EngagementHistoryCard({ employeeId }: { employeeId: string }) {
  const reviews = useEmployeePerformanceReviews(employeeId);
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none transition-colors hover:bg-accent/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <CardTitle>Engagement History</CardTitle>
                {reviews.length > 0 && <Badge variant="secondary">{reviews.length}</Badge>}
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No engagement data recorded yet.</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">{review.reviewDate}</span>
                    <span className="text-xs text-muted-foreground">by {review.reviewerName}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <SatisfactionLine label="Environment" score={review.environmentSatisfaction} />
                    <SatisfactionLine label="Job" score={review.jobSatisfaction} />
                    <SatisfactionLine label="Relationship" score={review.relationshipSatisfaction} />
                    <SatisfactionLine label="Work-Life" score={review.workLifeBalance} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Training sessions taken: <span className="font-semibold text-foreground">{review.trainingOpportunitiesTaken}</span>
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function SatisfactionLine({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${score * 20}%` }} />
        </div>
        <span className="w-8 text-right font-semibold">{score}/5</span>
      </div>
    </div>
  );
}
