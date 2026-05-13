import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
  Star,
  TrendingUp,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  getDepartments,
  getEmployee,
  getEmployeeLeaveRequests,
  getEmployees,
  getEmployeeSkills,
  getPositions,
  getSalaryHistory,
  getSkillHistory,
  getSkillsGap,
  getTeams,
  updateEmployee,
  type EmployeeProfile,
  type EmployeeSkill,
  type SkillHistoryEntry,
  type SkillsGapItem,
  type SkillsGapResult,
  type UpdateEmployeeDto,
} from "@/lib/api/hr-core";
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

export default function EmployeeProfile() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
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

  const evolution = useMemo(() => buildSkillEvolution(skillHistory), [skillHistory]);

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
  const salaryChartData = salaryHistory.map((entry) => ({
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
              <QuickStatsCard leaveCount={leaveRequests.length} skillsCount={skills.length} salaryCount={salaryHistory.length} reviewCount={reviews.length} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leave-history" className="mt-6">
          <LeaveHistoryCard leaveRequests={leaveRequests} />
        </TabsContent>

        <TabsContent value="skills" className="mt-6 space-y-6">
          <GapRadarCard gap={skillsGap ?? null} />
          <SkillsGridCard skills={skills} />
          <SkillsGapCard gap={skillsGap ?? null} />
          <SkillEvolutionCard evolution={evolution} />
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
                <div className="mb-6 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salaryChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="gross" stroke="#6366f1" name="Gross" dot />
                      <Line type="monotone" dataKey="net" stroke="#10b981" name="Net" dot />
                    </LineChart>
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
                    {salaryHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.effectiveDate.slice(0, 10)}</TableCell>
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
  salaryCount,
  reviewCount,
}: {
  leaveCount: number;
  skillsCount: number;
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
                  <TableCell>{request.startDate}</TableCell>
                  <TableCell>{request.endDate}</TableCell>
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

function SkillsGridCard({ skills }: { skills: EmployeeSkill[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills and Proficiency</CardTitle>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No skills recorded yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => {
              const level = skillLevel(skill);
              return (
                <div key={skill.id} className="rounded-lg border bg-card p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{skill.skill.name}</p>
                      <p className="text-xs text-muted-foreground">{skill.skill.category ?? "General"}</p>
                    </div>
                    <Badge variant="secondary">{levelLabel(level)}</Badge>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${levelRank(level) * 20}%`, backgroundColor: PROFICIENCY_COLORS[level] ?? "#6b7280" }} />
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

function SkillsGapCard({ gap }: { gap: SkillsGapResult | null }) {
  const [activeTab, setActiveTab] = useState<"domain" | "level" | "detail">("domain");

  const byDomain = useMemo(() => {
    if (!gap) return [];
    const map = new Map<string, { met: number; gaps: number; total: number; required: number[]; acquired: number[] }>();
    for (const item of gap.items) {
      const domain = item.skill.domain ?? "DOMAIN_EXPERTISE";
      if (!map.has(domain)) map.set(domain, { met: 0, gaps: 0, total: 0, required: [], acquired: [] });
      const entry = map.get(domain)!;
      entry.total++;
      entry.required.push(GAP_RANK[item.requiredProficiency] ?? 0);
      entry.acquired.push(item.acquiredProficiency != null ? (GAP_RANK[item.acquiredProficiency] ?? 0) : 0);
      if (item.status === "MET" || item.status === "EXCEEDS") entry.met++;
      else entry.gaps++;
    }
    return Array.from(map.entries()).map(([domain, stats]) => ({
      domain,
      label: DOMAIN_LABELS[domain] ?? domain,
      ...stats,
      avgRequired: stats.required.reduce((a, b) => a + b, 0) / stats.required.length,
      avgAcquired: stats.acquired.reduce((a, b) => a + b, 0) / stats.acquired.length,
    }));
  }, [gap]);

  const byLevel = useMemo(() => {
    if (!gap) return [];
    const levels: SkillsGapItem["requirementLevel"][] = ["MANDATORY", "EXPECTED", "NICE_TO_HAVE"];
    return levels.map((level) => {
      const items = gap.items.filter((i) => i.requirementLevel === level);
      const met = items.filter((i) => i.status === "MET" || i.status === "EXCEEDS").length;
      return { level, label: REQUIREMENT_LABELS[level] ?? level, total: items.length, met, gaps: items.length - met, items };
    }).filter((r) => r.total > 0);
  }, [gap]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-500" />
          <CardTitle>Skills Gap Analysis</CardTitle>
          {gap?.positionTitle && <span className="ml-auto text-xs text-muted-foreground">vs. {gap.positionTitle}</span>}
        </div>
      </CardHeader>
      <CardContent>
        {!gap ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No skills gap available for this employee.</p>
        ) : (
          <div className="space-y-5">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <GapStat label="Met" value={gap.summary.met} tone="text-green-700 bg-green-50" />
              <GapStat label="Exceeds" value={gap.summary.exceeds} tone="text-indigo-700 bg-indigo-50" />
              <GapStat label="Partial" value={gap.summary.partial} tone="text-amber-700 bg-amber-50" />
              <GapStat label="Missing" value={gap.summary.missing} tone="text-red-700 bg-red-50" />
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
              {(["domain", "level", "detail"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeTab === tab
                      ? "bg-white dark:bg-gray-800 shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "domain" ? "By Domain" : tab === "level" ? "By Requirement" : "All Skills"}
                </button>
              ))}
            </div>

            {/* By Domain */}
            {activeTab === "domain" && (
              <div className="space-y-3">
                {byDomain.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No domain information on required skills yet.</p>
                ) : (
                  byDomain.map(({ domain, label, total, met, gaps, avgRequired, avgAcquired }) => (
                    <div key={domain} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">{met}/{total} skills met</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${avgRequired > 0 ? (avgAcquired / avgRequired) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-20 text-right">
                          {avgAcquired.toFixed(1)} / {avgRequired.toFixed(1)}
                        </span>
                      </div>
                      {gaps > 0 && (
                        <p className="text-xs text-red-600 dark:text-red-400">{gaps} gap{gaps > 1 ? "s" : ""} remaining</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* By Requirement Level */}
            {activeTab === "level" && (
              <div className="space-y-3">
                {byLevel.map(({ level, label, total, met, gaps, items }) => (
                  <div key={level} className="space-y-3 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className={`rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${REQUIREMENT_COLORS[level] ?? ""}`}>
                        {label}
                      </div>
                      <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${
                            level === "MANDATORY" ? "bg-red-500" : level === "EXPECTED" ? "bg-amber-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${total > 0 ? (met / total) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{met}/{total} met</span>
                      {gaps > 0 && (
                        <span className="text-xs text-red-600 dark:text-red-400 whitespace-nowrap">{gaps} gap{gaps > 1 ? "s" : ""}</span>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {items.map((item) => (
                        <div key={`${level}-${item.skill.id}`} className="rounded-md bg-muted/40 p-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{item.skill.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.skill.domain ? DOMAIN_LABELS[item.skill.domain] ?? item.skill.domain : (item.skill.category ?? "General")}
                              </p>
                            </div>
                            <Badge variant="outline" className="h-fit" style={{ borderColor: GAP_COLORS[item.status], color: GAP_COLORS[item.status] }}>
                              {item.status}
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <span className="rounded bg-background px-2 py-1 text-muted-foreground">
                              Required: <b className="text-foreground">{levelLabel(item.requiredProficiency)}</b>
                            </span>
                            <span className="rounded bg-background px-2 py-1 text-muted-foreground">
                              Employee: <b className="text-foreground">{levelLabel(item.acquiredProficiency)}</b>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detail list */}
            {activeTab === "detail" && (
              <div className="space-y-2">
                {gap.items.map((item) => (
                  <div key={`${item.skill.id}-${item.requirementLevel}`} className="grid gap-3 rounded-lg border-l-4 bg-muted/30 p-3 md:grid-cols-[1fr_120px_120px_100px]" style={{ borderLeftColor: GAP_COLORS[item.status] }}>
                    <div>
                      <p className="text-sm font-medium">{item.skill.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {item.skill.domain ? DOMAIN_LABELS[item.skill.domain] ?? item.skill.domain : (item.skill.category ?? "General")}
                        </span>
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${REQUIREMENT_COLORS[item.requirementLevel] ?? ""}`}>
                          {REQUIREMENT_LABELS[item.requirementLevel] ?? item.requirementLevel}
                        </span>
                      </div>
                    </div>
                    <LevelPill label="Required" level={item.requiredProficiency} />
                    <LevelPill label="Acquired" level={item.acquiredProficiency} />
                    <Badge variant="outline" className="h-fit justify-center" style={{ borderColor: GAP_COLORS[item.status], color: GAP_COLORS[item.status] }}>{item.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GapStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg p-3 text-center ${tone}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

function LevelPill({ label, level }: { label: string; level: string | null }) {
  const rank = levelRank(level);
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full" style={{ width: `${rank * 20}%`, backgroundColor: level ? PROFICIENCY_COLORS[level] ?? "#6b7280" : "#d1d5db" }} />
        </div>
        <span className="text-xs font-medium">{levelLabel(level)}</span>
      </div>
    </div>
  );
}

type SkillEvolution = {
  chartRows: Array<Record<string, string | number | null>>;
  diffRows: Array<{ skill: string; before: number; after: number; delta: number }>;
  skillNames: string[];
  snapshots: string[];
};

function buildSkillEvolution(history: SkillHistoryEntry[]): SkillEvolution {
  const sorted = [...history].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const current = new Map<string, number>();
  const skillNames = Array.from(new Set(sorted.map((entry) => entry.skill.name)));
  const chartRows = sorted.map((entry) => {
    current.set(entry.skill.name, levelRank(entry.newLevel));
    const row: Record<string, string | number | null> = {
      label: entry.effectiveDate.slice(0, 10),
    };
    for (const skill of skillNames) {
      row[skill] = current.get(skill) ?? null;
    }
    return row;
  });

  const first = chartRows[0];
  const last = chartRows[chartRows.length - 1];
  const diffRows = first && last
    ? skillNames.map((skill) => {
        const before = typeof first[skill] === "number" ? first[skill] : 0;
        const after = typeof last[skill] === "number" ? last[skill] : 0;
        return { skill, before, after, delta: after - before };
      })
    : [];

  return {
    chartRows,
    diffRows,
    skillNames,
    snapshots: chartRows.map((row) => String(row.label)),
  };
}

function SkillEvolutionCard({ evolution }: { evolution: SkillEvolution }) {
  if (evolution.chartRows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Skill Evolution</CardTitle>
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
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          <CardTitle>Skill Evolution</CardTitle>
          <span className="ml-auto text-xs text-muted-foreground">{evolution.snapshots[0]} to {evolution.snapshots[evolution.snapshots.length - 1]}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolution.chartRows} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`${value}/5`, "Level"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {evolution.skillNames.map((skill, index) => (
                <Line key={skill} type="monotone" dataKey={skill} stroke={["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9"][index % 6]} strokeWidth={2} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="space-y-2">
            {evolution.diffRows.map((row) => (
              <div key={row.skill} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.skill}</span>
                <Badge variant="outline">{row.before}/5</Badge>
                <span className="text-muted-foreground">to</span>
                <Badge variant="secondary">{row.after}/5</Badge>
                <span className={row.delta >= 0 ? "text-sm font-semibold text-green-600" : "text-sm font-semibold text-red-600"}>
                  {row.delta > 0 ? `+${row.delta}` : row.delta}
                </span>
              </div>
            ))}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolution.diffRows}>
                <XAxis dataKey="skill" hide />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="delta" name="Change">
                  {evolution.diffRows.map((row) => (
                    <Cell key={row.skill} fill={row.delta >= 0 ? "#16a34a" : "#dc2626"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
