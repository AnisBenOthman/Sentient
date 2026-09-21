import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { getGatewayErrorMessage } from "@/lib/api/gateway-error";
import { useAuth } from "@/components/providers/auth-provider";
import { LinkedChannelsCard } from "@/components/linked-channels-card";
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

const CONTRACT_TYPES = ["FULL_TIME", "PART_TIME", "INTERN", "CONTRACTOR", "FIXED_TERM"] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  ON_LEAVE: "destructive",
  PROBATION: "secondary",
  TERMINATED: "destructive",
  RESIGNED: "outline",
};

// Radar uses 0 for missing skills, then a 1-4 ladder for recorded proficiency.
const GAP_CHART_RANK: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const REQUIREMENT_COLORS: Record<string, string> = {
  MANDATORY: "border-red-200 text-red-700 bg-red-50 dark:bg-red-900/20",
  EXPECTED: "border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-900/20",
  NICE_TO_HAVE: "border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20",
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

// Labels for these live in `employees:profile.skillStatus.*`; only the styling
// belongs at module scope, where `t()` is not available.
const SKILL_STATUS_META: Record<"MET" | "EXCEEDS" | "PARTIAL" | "MISSING", {
  color: string; cls: string;
}> = {
  MET:     { color: "#10b981", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300" },
  EXCEEDS: { color: "#6366f1", cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300" },
  PARTIAL: { color: "#f59e0b", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300" },
  MISSING: { color: "#ef4444", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300" },
};

const GAP_COLORS: Record<SkillsGapItem["status"], string> = {
  MET: "#16a34a",
  EXCEEDS: "#4f46e5",
  PARTIAL: "#f59e0b",
  MISSING: "#dc2626",
};

const GAP_RADAR_REQUIRED_COLOR = "#f59e0b";
const GAP_RADAR_ACQUIRED_COLOR = "#3b82f6";

type DraftProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  contractType: string;
  grossSalary: string;
  netSalary: string;
  gender: string;
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

function formatDate(value: string | null | undefined, locale: string, naLabel: string): string {
  if (!value) return naLabel;
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// WHY: currency is resolved server-side from the employee's department/team
// business unit. `undefined` (arg omitted) preserves the historical DZD
// default for call sites that don't carry a resolved employee; an explicit
// `null` means "known to be unresolved" and must not guess a currency.
const LEGACY_DEFAULT_CURRENCY = "DZD";

function formatMoney(value: number | null, currency: string | null | undefined, locale: string, naLabel: string): string {
  if (value == null) return naLabel;
  if (currency === null) return value.toLocaleString(locale);
  return value.toLocaleString(locale, { style: "currency", currency: currency ?? LEGACY_DEFAULT_CURRENCY });
}

function formatPercent(value: number | null, naLabel: string): string {
  return value == null ? naLabel : `${value.toFixed(1)}%`;
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
    gender: normalizeSelect(emp.gender),
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
    gender: denormalizeSelect(draft.gender),
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
  const { t } = useTranslation("employees");
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="font-medium" data-testid={testId}>
        {value ?? t("profile.na")}
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

/**
 * WHY a hook rather than the module-scope maps this replaced: `t()` only exists
 * inside a component. Every entry is spelled out with a literal key so
 * i18next's typed `t` still checks it, and the maps come back as
 * `Record<string, string>` because HR Core hands these enums back as plain
 * strings — a lookup that misses falls back to the raw value at the call site.
 */
interface EmployeeLabelMaps {
  contract: Record<string, string>;
  status: Record<string, string>;
  proficiency: Record<string, string>;
  domain: Record<string, string>;
  requirement: Record<string, string>;
  skillStatus: Record<string, string>;
  gender: Record<string, string>;
  marital: Record<string, string>;
  education: Record<string, string>;
}

function useEmployeeLabels(): EmployeeLabelMaps {
  const { t } = useTranslation("employees");
  return useMemo(
    () => ({
      contract: {
        FULL_TIME: t("profile.contractTypes.FULL_TIME"),
        PART_TIME: t("profile.contractTypes.PART_TIME"),
        INTERN: t("profile.contractTypes.INTERN"),
        CONTRACTOR: t("profile.contractTypes.CONTRACTOR"),
        FIXED_TERM: t("profile.contractTypes.FIXED_TERM"),
      },
      status: {
        ACTIVE: t("status.ACTIVE"),
        ON_LEAVE: t("status.ON_LEAVE"),
        PROBATION: t("status.PROBATION"),
        TERMINATED: t("status.TERMINATED"),
        RESIGNED: t("status.RESIGNED"),
      },
      proficiency: {
        BEGINNER: t("profile.proficiency.BEGINNER"),
        DEVELOPING: t("profile.proficiency.DEVELOPING"),
        INTERMEDIATE: t("profile.proficiency.INTERMEDIATE"),
        PROFICIENT: t("profile.proficiency.PROFICIENT"),
        ADVANCED: t("profile.proficiency.ADVANCED"),
        EXPERT: t("profile.proficiency.EXPERT"),
      },
      domain: {
        TECHNICAL: t("profile.domains.TECHNICAL"),
        LEADERSHIP: t("profile.domains.LEADERSHIP"),
        SOFT_SKILLS: t("profile.domains.SOFT_SKILLS"),
        DOMAIN_EXPERTISE: t("profile.domains.DOMAIN_EXPERTISE"),
      },
      requirement: {
        MANDATORY: t("profile.requirements.MANDATORY"),
        EXPECTED: t("profile.requirements.EXPECTED"),
        NICE_TO_HAVE: t("profile.requirements.NICE_TO_HAVE"),
      },
      skillStatus: {
        ALL: t("profile.skillStatus.ALL"),
        GAPS: t("profile.skillStatus.GAPS"),
        MET: t("profile.skillStatus.MET"),
        EXCEEDS: t("profile.skillStatus.EXCEEDS"),
        PARTIAL: t("profile.skillStatus.PARTIAL"),
        MISSING: t("profile.skillStatus.MISSING"),
      },
      gender: {
        FEMALE: t("profile.genders.FEMALE"),
        MALE: t("profile.genders.MALE"),
        NON_BINARY: t("profile.genders.NON_BINARY"),
        PREFER_NOT_TO_SAY: t("profile.genders.PREFER_NOT_TO_SAY"),
      },
      marital: {
        SINGLE: t("profile.marital.SINGLE"),
        MARRIED: t("profile.marital.MARRIED"),
        DIVORCED: t("profile.marital.DIVORCED"),
        WIDOWED: t("profile.marital.WIDOWED"),
      },
      education: {
        BELOW_COLLEGE: t("profile.education.BELOW_COLLEGE"),
        COLLEGE: t("profile.education.COLLEGE"),
        BACHELOR: t("profile.education.BACHELOR"),
        MASTER: t("profile.education.MASTER"),
        DOCTOR: t("profile.education.DOCTOR"),
      },
    }),
    [t],
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels = useEmployeeLabels();
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {labels.status[status] ?? status}
    </Badge>
  );
}

function SalaryTooltip({
  active,
  payload,
  label,
  currency,
  locale,
  naLabel,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  /** The employee's resolved currency — the chart must not assume DZD. */
  currency?: string | null;
  locale: string;
  naLabel: string;
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
            {formatMoney(entry.value, currency, locale, naLabel)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Appends " (n)" to a tab label, or nothing when the tab has no rows yet. */
function withCount(label: string, count: number): string {
  return count > 0 ? `${label} (${count})` : label;
}

export default function EmployeeProfile({ employeeId }: { employeeId?: string }) {
  const params = useParams<{ id: string }>();
  const id = employeeId ?? params.id ?? "";
  const { user } = useAuth();
  const { t, i18n } = useTranslation(["employees", "common"]);
  const labels = useEmployeeLabels();
  const isSelf = !!user?.employeeId && user.employeeId === id;
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const search = useSearch();
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
      setFormError(getGatewayErrorMessage(error, t("profile.saveFailed")));
    },
  });

  const allEmployees = employeesResult?.data ?? [];
  const directReports = useMemo(
    () => allEmployees.filter((employee) => (employee.managerId ?? employee.manager?.id) === id),
    [allEmployees, id],
  );

  const reviews = useEmployeePerformanceReviews(id);
  const canEditProfile = user ? getRoleTier(user) === "hr_admin" : false;

  /**
   * WHY the active tab lives in the URL: the guided tour sends the user to
   * /profile?tab=channels to show where Slack and Telegram link codes come
   * from, and a tab that only existed in component state could not be reached
   * that way. It also makes every tab shareable as a link.
   *
   * Derived on each render rather than mirrored into state, so a tab that only
   * becomes available once its query resolves — salary history — still opens
   * when it was requested before the data arrived.
   */
  const availableTabs = useMemo(() => {
    const tabs = ["details", "leave-history", "skills", "promotions", "performance"];
    if (salaryHistory.length > 0) tabs.push("salary");
    if (isSelf) tabs.push("channels");
    return tabs;
  }, [salaryHistory.length, isSelf]);

  const requestedTab = new URLSearchParams(search).get("tab");
  const activeTab = requestedTab && availableTabs.includes(requestedTab) ? requestedTab : "details";

  function selectTab(tab: string): void {
    const next = new URLSearchParams(search);
    if (tab === "details") next.delete("tab");
    else next.set("tab", tab);
    const query = next.toString();
    // Replace rather than push: tab switching should not stack history entries
    // the user has to click Back through to leave the profile.
    navigate(query ? `${location}?${query}` : location, { replace: true });
  }

  if (loadingEmp) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t("profile.loading")}</p>
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center">
        <h2 className="mb-2 text-2xl font-bold">{t("profile.notFound")}</h2>
        <p className="mb-4 text-muted-foreground">{t("profile.notFoundHint")}</p>
        <Link href="/employees">
          <Button>{t("profile.backToDirectory")}</Button>
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
  // WHY null rather than a placeholder string: this value is both displayed
  // and tested below, and a translated placeholder would never match a literal.
  const profileBusinessUnitName =
    employee.team?.businessUnit?.name ??
    employee.department?.businessUnit?.name ??
    profileDepartment?.businessUnit?.name ??
    null;
  const draftDepartment = currentDraft.departmentId !== NONE
    ? departments.find((department) => department.id === currentDraft.departmentId)
    : undefined;
  const draftBusinessUnitName = draftDepartment?.businessUnit?.name ?? t("profile.unassigned");
  const profileOrgPath = [
    profileBusinessUnitName ?? undefined,
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
          {t("profile.backToDirectory")}
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
            <p className="mt-1 text-xl text-muted-foreground">{emp.position?.title ?? t("profile.na")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={emp.employmentStatus} />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                {profileOrgPath || t("profile.unassigned")}
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
                  {t("common:cancel")}
                </Button>
                <Button className="gap-2" onClick={saveEditing} disabled={updateMutation.isPending}>
                  <Check className="h-4 w-4" />
                  {t("profile.saveChanges")}
                </Button>
              </>
            ) : (
              <Button variant="outline" className="gap-2" onClick={startEditing} data-testid="button-edit-profile">
                <Check className="h-4 w-4" />
                {t("profile.edit")}
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

      <Tabs value={activeTab} onValueChange={selectTab} className="pt-2">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="details">{t("profile.tabs.details")}</TabsTrigger>
          <TabsTrigger value="leave-history">{withCount(t("profile.tabs.leaveHistory"), leaveRequests.length)}</TabsTrigger>
          <TabsTrigger value="skills">{withCount(t("profile.tabs.skills"), skills.length)}</TabsTrigger>
          <TabsTrigger value="promotions">{withCount(t("profile.tabs.promotions"), promotionRequests.length)}</TabsTrigger>
          <TabsTrigger value="performance">{withCount(t("profile.tabs.performance"), reviews.length)}</TabsTrigger>
          {salaryHistory.length > 0 && <TabsTrigger value="salary">{t("profile.tabs.salary")}</TabsTrigger>}
          {isSelf && (
            <TabsTrigger value="channels" data-tour="linked-channels-tab">
              {t("profile.tabs.channels")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-6 md:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-indigo-500" />
                    <CardTitle>{t("profile.sections.professionalDetails")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {editMode ? (
                    <>
                      <EditField icon={UserCheck} label={t("profile.firstName")}>
                        <Input value={currentDraft.firstName} onChange={(event) => patchDraft({ firstName: event.target.value })} />
                      </EditField>
                      <EditField icon={UserCheck} label={t("profile.lastName")}>
                        <Input value={currentDraft.lastName} onChange={(event) => patchDraft({ lastName: event.target.value })} />
                      </EditField>
                      <EditField icon={Briefcase} label={t("profile.position")}>
                        <Select value={currentDraft.positionId} onValueChange={(value) => patchDraft({ positionId: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t("profile.unassigned")}</SelectItem>
                            {positions.map((position) => (
                              <SelectItem key={position.id} value={position.id}>{position.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={Award} label={t("profile.contractType")}>
                        <Select value={currentDraft.contractType} onValueChange={(value) => patchDraft({ contractType: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONTRACT_TYPES.map((value) => (
                              <SelectItem key={value} value={value}>{labels.contract[value]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={Building} label={t("profile.businessUnit")}>
                        <Input value={draftBusinessUnitName} disabled />
                      </EditField>
                      <EditField icon={Building} label={t("profile.department")}>
                        <Select value={currentDraft.departmentId} onValueChange={(value) => patchDraft({ departmentId: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t("profile.unassigned")}</SelectItem>
                            {departments.map((department) => (
                              <SelectItem key={department.id} value={department.id}>
                                {department.businessUnit?.name ? `${department.businessUnit.name} / ${department.name}` : department.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={Users} label={t("profile.team")}>
                        <Select value={currentDraft.teamId} onValueChange={(value) => patchDraft({ teamId: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t("profile.unassigned")}</SelectItem>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={UserCheck} label={t("profile.manager")}>
                        <Select value={currentDraft.managerId} onValueChange={(value) => patchDraft({ managerId: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t("profile.unassigned")}</SelectItem>
                            {allEmployees.filter((employee) => employee.id !== emp.id).map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>{fullName(employee)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EditField>
                    </>
                  ) : (
                    <>
                      <InfoRow icon={Hash} label={t("profile.employeeCode")} value={<span className="font-mono">{emp.employeeCode}</span>} />
                      <InfoRow icon={UserCheck} label={t("profile.fullName")} value={name} testId="text-name" />
                      <InfoRow icon={Briefcase} label={t("profile.jobTitle")} value={emp.position?.title} testId="text-role" />
                      <InfoRow icon={Award} label={t("profile.contractType")} value={labels.contract[emp.contractType] ?? emp.contractType} />
                      <InfoRow icon={Building} label={t("profile.businessUnit")} value={profileBusinessUnitName ?? t("profile.unassigned")} />
                      <InfoRow icon={Building} label={t("profile.department")} value={emp.department?.name} />
                      <InfoRow icon={Users} label={t("profile.team")} value={emp.team?.name} />
                      <InfoRow icon={UserCheck} label={t("profile.manager")} value={emp.manager ? fullName(emp.manager) : null} />
                      <InfoRow icon={Calendar} label={t("profile.hireDate")} value={formatDate(emp.hireDate, i18n.language, t("common:notAvailable"))} />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <CardTitle>{t("profile.sections.contactPersonal")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {editMode ? (
                    <>
                      <EditField icon={Mail} label={t("profile.email")}>
                        <Input type="email" value={currentDraft.email} onChange={(event) => patchDraft({ email: event.target.value })} />
                      </EditField>
                      <EditField icon={Phone} label={t("profile.phone")}>
                        <Input value={currentDraft.phone} onChange={(event) => patchDraft({ phone: event.target.value })} />
                      </EditField>
                      <EditField icon={Calendar} label={t("profile.dateOfBirth")}>
                        <Input type="date" value={currentDraft.dateOfBirth} onChange={(event) => patchDraft({ dateOfBirth: event.target.value })} />
                      </EditField>
                      <EditField icon={UserCheck} label={t("profile.gender")}>
                        <Select value={currentDraft.gender} onValueChange={(value) => patchDraft({ gender: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t("profile.unspecified")}</SelectItem>
                            <SelectItem value="FEMALE">{labels.gender.FEMALE}</SelectItem>
                            <SelectItem value="MALE">{labels.gender.MALE}</SelectItem>
                            <SelectItem value="NON_BINARY">{labels.gender.NON_BINARY}</SelectItem>
                            <SelectItem value="PREFER_NOT_TO_SAY">{labels.gender.PREFER_NOT_TO_SAY}</SelectItem>
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={Heart} label={t("profile.maritalStatus")}>
                        <Select value={currentDraft.maritalStatus} onValueChange={(value) => patchDraft({ maritalStatus: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t("profile.unspecified")}</SelectItem>
                            <SelectItem value="SINGLE">{labels.marital.SINGLE}</SelectItem>
                            <SelectItem value="MARRIED">{labels.marital.MARRIED}</SelectItem>
                            <SelectItem value="DIVORCED">{labels.marital.DIVORCED}</SelectItem>
                            <SelectItem value="WIDOWED">{labels.marital.WIDOWED}</SelectItem>
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={GraduationCap} label={t("profile.educationLevel")}>
                        <Select value={currentDraft.educationLevel} onValueChange={(value) => patchDraft({ educationLevel: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t("profile.unspecified")}</SelectItem>
                            <SelectItem value="BELOW_COLLEGE">{labels.education.BELOW_COLLEGE}</SelectItem>
                            <SelectItem value="COLLEGE">{labels.education.COLLEGE}</SelectItem>
                            <SelectItem value="BACHELOR">{labels.education.BACHELOR}</SelectItem>
                            <SelectItem value="MASTER">{labels.education.MASTER}</SelectItem>
                            <SelectItem value="DOCTOR">{labels.education.DOCTOR}</SelectItem>
                          </SelectContent>
                        </Select>
                      </EditField>
                      <EditField icon={GraduationCap} label={t("profile.educationField")}>
                        <Input value={currentDraft.educationField} onChange={(event) => patchDraft({ educationField: event.target.value })} />
                      </EditField>
                    </>
                  ) : (
                    <>
                      <InfoRow icon={Mail} label={t("profile.email")} value={emp.email} />
                      <InfoRow icon={Phone} label={t("profile.phone")} value={emp.phone} />
                      <InfoRow icon={Calendar} label={t("profile.dateOfBirth")} value={formatDate(emp.dateOfBirth, i18n.language, t("common:notAvailable"))} />
                      <InfoRow icon={UserCheck} label={t("profile.gender")} value={emp.gender ? labels.gender[emp.gender] ?? emp.gender : null} />
                      <InfoRow icon={Heart} label={t("profile.maritalStatus")} value={emp.maritalStatus ? labels.marital[emp.maritalStatus] ?? emp.maritalStatus : null} />
                      <InfoRow icon={GraduationCap} label={t("profile.educationLevel")} value={emp.educationLevel ? labels.education[emp.educationLevel] ?? emp.educationLevel : null} />
                      <InfoRow icon={GraduationCap} label={t("profile.educationField")} value={emp.educationField} />
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
                    <CardTitle>{t("profile.sections.compensation")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editMode ? (
                    <>
                      <EditField icon={DollarSign} label={t("profile.grossSalary")}>
                        <Input value={currentDraft.grossSalary} onChange={(event) => patchDraft({ grossSalary: event.target.value })} />
                      </EditField>
                      <EditField icon={DollarSign} label={t("profile.netSalary")}>
                        <Input value={currentDraft.netSalary} onChange={(event) => patchDraft({ netSalary: event.target.value })} />
                      </EditField>
                      <EditField icon={TrendingUp} label={t("profile.salaryChangeReason")}>
                        <Select value={currentDraft.salaryChangeReason} onValueChange={(value) => patchDraft({ salaryChangeReason: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PROMOTION">{t("profile.salaryReasons.PROMOTION")}</SelectItem>
                            <SelectItem value="ANNUAL_REVIEW">{t("profile.salaryReasons.ANNUAL_REVIEW")}</SelectItem>
                            <SelectItem value="NEW_FUNCTION">{t("profile.salaryReasons.NEW_FUNCTION")}</SelectItem>
                            <SelectItem value="OTHER">{t("profile.salaryReasons.OTHER")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </EditField>
                      {currentDraft.salaryChangeReason === "OTHER" && (
                        <EditField icon={TrendingUp} label={t("profile.reasonComment")}>
                          <Input value={currentDraft.salaryChangeComment} onChange={(event) => patchDraft({ salaryChangeComment: event.target.value })} />
                        </EditField>
                      )}
                    </>
                  ) : (
                    <>
                      <InfoRow icon={DollarSign} label={t("profile.grossSalary")} value={formatMoney(emp.grossSalary, emp.currency, i18n.language, t("common:notAvailable"))} />
                      <InfoRow icon={DollarSign} label={t("profile.netSalary")} value={formatMoney(emp.netSalary, emp.currency, i18n.language, t("common:notAvailable"))} />
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
                <CardTitle>{t("profile.sections.salaryHistory")}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Legend chips */}
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    {t("profile.salaryTable.gross")}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    {t("profile.salaryTable.net")}
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
                      <Tooltip
                        content={<SalaryTooltip currency={emp.currency} locale={i18n.language} naLabel={t("common:notAvailable")} />}
                        cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="gross"
                        name={t("profile.salaryTable.gross")}
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#gradGross)"
                        dot={false}
                        activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="net"
                        name={t("profile.salaryTable.net")}
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
                      <TableHead>{t("profile.salaryTable.effectiveDate")}</TableHead>
                      <TableHead>{t("profile.salaryTable.grossBefore")}</TableHead>
                      <TableHead>{t("profile.salaryTable.grossAfter")}</TableHead>
                      <TableHead>{t("profile.salaryTable.netBefore")}</TableHead>
                      <TableHead>{t("profile.salaryTable.netAfter")}</TableHead>
                      <TableHead>{t("profile.salaryTable.reason")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSalaryHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.effectiveDate, i18n.language, t("common:notAvailable"))}</TableCell>
                        <TableCell>{formatMoney(entry.grossBefore, entry.currency, i18n.language, t("common:notAvailable"))}</TableCell>
                        <TableCell className="font-semibold">{formatMoney(entry.grossAfter, entry.currency, i18n.language, t("common:notAvailable"))}</TableCell>
                        <TableCell>{formatMoney(entry.netBefore, entry.currency, i18n.language, t("common:notAvailable"))}</TableCell>
                        <TableCell className="font-semibold">{formatMoney(entry.netAfter, entry.currency, i18n.language, t("common:notAvailable"))}</TableCell>
                        <TableCell>{entry.reason ?? t("profile.na")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isSelf && (
          <TabsContent value="channels" className="mt-6 max-w-2xl">
            <LinkedChannelsCard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function DirectReportsCard({ directReports }: { directReports: EmployeeProfile[] }) {
  const { t } = useTranslation("employees");
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          <CardTitle>{t("profile.sections.directReports")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {directReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("profile.noDirectReports")}</p>
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
  const { t } = useTranslation("employees");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("profile.sections.quickStats")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <StatLine label={t("profile.stats.leaveRequests")} value={leaveCount} />
        <StatLine label={t("profile.stats.skills")} value={skillsCount} />
        <StatLine label={t("profile.stats.promotionRequests")} value={promotionCount} />
        <StatLine label={t("profile.stats.salaryChanges")} value={salaryCount} />
        <StatLine label={t("profile.stats.performanceReviews")} value={reviewCount} />
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
  const { t } = useTranslation(["employees", "common"]);
  // Approval vocabulary is shared app-wide, so it lives in `common:status.*`.
  const statusLabels: Record<PromotionRequest["status"], string> = {
    PENDING: t("common:status.pending"),
    APPROVED: t("common:status.approved"),
    REJECTED: t("common:status.rejected"),
  };
  const classes: Record<PromotionRequest["status"], string> = {
    PENDING: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    REJECTED: "border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  };

  return (
    <Badge variant="outline" className={classes[status] ?? "capitalize"}>
      {statusLabels[status] ?? status}
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
  const { t, i18n } = useTranslation(["employees", "common"]);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-amber-500" />
          <CardTitle>{t("profile.sections.promotionHistory")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("profile.promotions.loading")}</p>
        ) : promotionRequests.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("profile.promotions.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("profile.promotions.submitted")}</TableHead>
                  <TableHead>{t("profile.promotions.roleChange")}</TableHead>
                  <TableHead>{t("profile.promotions.status")}</TableHead>
                  <TableHead className="text-right">{t("profile.promotions.salaryChange")}</TableHead>
                  <TableHead className="text-right">{t("profile.promotions.budgetImpact")}</TableHead>
                  <TableHead>{t("profile.promotions.requestedBy")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotionRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{formatDate(request.submittedAt, i18n.language, t("common:notAvailable"))}</TableCell>
                    <TableCell>
                      <div className="max-w-[260px] text-sm">
                        <span>{request.currentRole}</span>
                        <span className="px-1.5 text-muted-foreground">{t("profile.promotions.to")}</span>
                        <span className="font-medium text-blue-700 dark:text-blue-400">{request.newRole}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PromotionStatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">{formatMoney(request.salaryDelta, undefined, i18n.language, t("common:notAvailable"))}</div>
                      <div className="text-xs text-muted-foreground">{formatPercent(request.salaryDeltaPercentage, t("common:notAvailable"))}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>{formatMoney(request.newTeamBudget - request.currentTeamBudget, undefined, i18n.language, t("common:notAvailable"))}</div>
                      <div className="text-xs text-muted-foreground">{formatPercent(request.budgetImpactPercentage, t("common:notAvailable"))}</div>
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
  const { t, i18n } = useTranslation(["employees", "common"]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.sections.leaveHistory")}</CardTitle>
      </CardHeader>
      <CardContent>
        {leaveRequests.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("profile.leaves.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("profile.leaves.type")}</TableHead>
                <TableHead>{t("profile.leaves.start")}</TableHead>
                <TableHead>{t("profile.leaves.end")}</TableHead>
                <TableHead>{t("profile.leaves.days")}</TableHead>
                <TableHead>{t("profile.leaves.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.leaveType?.name ?? request.leaveTypeId}</TableCell>
                  <TableCell>{formatDate(request.startDate, i18n.language, t("common:notAvailable"))}</TableCell>
                  <TableCell>{formatDate(request.endDate, i18n.language, t("common:notAvailable"))}</TableCell>
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
  const { t } = useTranslation("employees");
  const labels = useEmployeeLabels();
  const radarRows = useMemo(() => {
    if (!gap || gap.items.length === 0) return [];

    return gap.items.map((item) => {
      const required = GAP_CHART_RANK[item.requiredProficiency] ?? 0;
      const acquired = item.acquiredProficiency ? (GAP_CHART_RANK[item.acquiredProficiency] ?? 0) : 0;

      return {
        skill: item.skill.name,
        required,
        acquired,
        requiredLabel: labels.proficiency[item.requiredProficiency] ?? item.requiredProficiency,
        acquiredLabel: item.acquiredProficiency
          ? (labels.proficiency[item.acquiredProficiency] ?? item.acquiredProficiency)
          : t("profile.skillStatus.MISSING"),
        requirementLevel: item.requirementLevel,
        status: item.status,
        gapSize: Math.max(required - acquired, 0),
        isPadding: false,
      };
    });
  }, [gap, labels, t]);

  const chartRows = useMemo(() => {
    const rows: Array<(typeof radarRows)[number] & { isPadding: boolean }> = [...radarRows];
    while (rows.length > 0 && rows.length < 3) {
      rows.push({
        skill: `Axis ${rows.length + 1}`,
        required: 0,
        acquired: 0,
        requiredLabel: "",
        acquiredLabel: "",
        requirementLevel: "NICE_TO_HAVE",
        status: "MET",
        gapSize: 0,
        isPadding: true,
      });
    }
    return rows;
  }, [radarRows]);

  const gapRows = radarRows.filter((row) => row.status === "PARTIAL" || row.status === "MISSING");
  const coveredCount = radarRows.filter((row) => row.status === "MET" || row.status === "EXCEEDS").length;
  const partialCount = radarRows.filter((row) => row.status === "PARTIAL").length;
  const missingCount = radarRows.filter((row) => row.status === "MISSING").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Star className="h-4 w-4 text-blue-500" />
          <CardTitle>{t("profile.sections.skillsGap")}</CardTitle>
          <span className="text-xs font-normal text-muted-foreground">
            {gap?.positionTitle
              ? t("profile.gap.vsPosition", { position: gap.positionTitle })
              : t("profile.gap.overlay")}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {!gap || radarRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {!gap ? t("profile.gap.noPosition") : t("profile.gap.noRequirements")}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-5">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: GAP_RADAR_ACQUIRED_COLOR }} />
                {t("profile.gap.employeeProficiency")}
              </span>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: GAP_RADAR_REQUIRED_COLOR }} />
                {t("profile.gap.roleRequired")}
              </span>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartRows} margin={{ top: 10, right: 42, bottom: 10, left: 42 }}>
                  <PolarGrid stroke="currentColor" className="text-gray-200 dark:text-gray-700" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-gray-500 dark:text-gray-400"
                    tickFormatter={(value: string, index: number) => chartRows[index]?.isPadding ? "" : value}
                  />
                  <PolarRadiusAxis domain={[0, 4]} tick={false} axisLine={false} />
                  <Radar
                    name={t("profile.gap.roleRequired")}
                    dataKey="required"
                    stroke={GAP_RADAR_REQUIRED_COLOR}
                    fill={GAP_RADAR_REQUIRED_COLOR}
                    fillOpacity={0.12}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={{ r: 3, fill: GAP_RADAR_REQUIRED_COLOR, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                  <Radar
                    name={t("profile.gap.employeeProficiency")}
                    dataKey="acquired"
                    stroke={GAP_RADAR_ACQUIRED_COLOR}
                    fill={GAP_RADAR_ACQUIRED_COLOR}
                    fillOpacity={0.25}
                    strokeWidth={2}
                    dot={{ r: 3, fill: GAP_RADAR_ACQUIRED_COLOR, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value > 0 ? `${value}/4` : t("profile.skillStatus.MISSING"),
                      name,
                    ]}
                    labelFormatter={(label: string) => label.startsWith("Axis ") ? "" : label}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      background: "white",
                      fontSize: "12px",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-emerald-50/60 p-3 dark:bg-emerald-900/10">
                <p className="text-xs font-medium text-muted-foreground">{t("profile.gap.covered")}</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{coveredCount}</p>
              </div>
              <div className="rounded-lg border bg-amber-50/70 p-3 dark:bg-amber-900/10">
                <p className="text-xs font-medium text-muted-foreground">{t("profile.gap.needsWork")}</p>
                <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-300">{partialCount}</p>
              </div>
              <div className="rounded-lg border bg-red-50/70 p-3 dark:bg-red-900/10">
                <p className="text-xs font-medium text-muted-foreground">{t("profile.gap.missing")}</p>
                <p className="mt-1 text-2xl font-semibold text-red-700 dark:text-red-300">{missingCount}</p>
              </div>
            </div>
            <div className="space-y-2">
              {gapRows.length === 0 ? (
                <div className="rounded-lg border bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/10 dark:text-emerald-300">
                  {t("profile.gap.allCovered")}
                </div>
              ) : (
                gapRows.map((row) => (
                  <div key={row.skill} className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_120px_120px_90px] sm:items-center">
                    <div>
                      <p className="text-sm font-medium">{row.skill}</p>
                      <p className="text-xs text-muted-foreground">
                        {labels.requirement[row.requirementLevel] ?? row.requirementLevel}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{t("profile.gap.required", { level: row.requiredLabel })}</span>
                    <span className="text-xs text-muted-foreground">{t("profile.gap.employee", { level: row.acquiredLabel })}</span>
                    <Badge variant={row.status === "MISSING" ? "destructive" : "secondary"} className="w-fit">
                      {labels.skillStatus[row.status] ?? row.status}
                    </Badge>
                  </div>
                ))
              )}
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
  const { t } = useTranslation("employees");
  const labels = useEmployeeLabels();
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
        employeeLevelLabel: labels.proficiency[empLevel] ?? empLevel,
        requiredRank: reqLevel ? (LEVEL_RANK_6[reqLevel] ?? null) : null,
        requiredLevelLabel: reqLevel ? (labels.proficiency[reqLevel] ?? reqLevel) : null,
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
            requiredLevelLabel: reqLevel ? (labels.proficiency[reqLevel] ?? reqLevel) : null,
            requirementLevel: item.requirementLevel,
            status: "MISSING",
          });
        }
      }
    }
    return rows;
  }, [skills, gap, labels]);

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
            <CardTitle>{t("profile.sections.skills")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{t("profile.skillsGrid.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  // Chip labels come from `labels.skillStatus`; only the styling lives here.
  const CHIP_CLASS: Record<"ALL" | "MET" | "EXCEEDS" | "PARTIAL" | "MISSING" | "GAPS", string> = {
    ALL:     "border-gray-400 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
    GAPS:    "border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    MET:     "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    EXCEEDS: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
    PARTIAL: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    MISSING: "border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <CardTitle>{t("profile.sections.skills")}</CardTitle>
          <span className="text-xs font-normal text-muted-foreground">
            {t("profile.skillsGrid.skillCount", { count: merged.length })}
            {gap?.positionTitle ? ` · ${t("profile.gap.vsPosition", { position: gap.positionTitle })}` : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search + Domain filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("profile.skillsGrid.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
          {domains.length > 0 && (
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder={t("profile.skillsGrid.allDomains")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("profile.skillsGrid.allDomains")}</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d} value={d}>{labels.domain[d] ?? d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", "GAPS", "MET", "EXCEEDS", "PARTIAL", "MISSING"] as const).map((s) => {
            const count = statusCounts[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
                  active
                    ? CHIP_CLASS[s]
                    : "border-gray-200 bg-white text-muted-foreground hover:border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                }`}
              >
                {labels.skillStatus[s] ?? s}
                <span className="min-w-[14px] rounded-full bg-current/10 px-1 text-center tabular-nums opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("profile.skillsGrid.noMatch")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => {
              const statusMeta = row.status ? SKILL_STATUS_META[row.status] : null;
              const statusLabel = row.status ? labels.skillStatus[row.status] ?? row.status : null;
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
                        {row.domain ? (labels.domain[row.domain] ?? row.domain) : (row.category ?? t("profile.skillsGrid.general"))}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {statusMeta && (
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${statusMeta.cls}`}>
                          {statusLabel}
                        </span>
                      )}
                      {row.requirementLevel && (
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${REQUIREMENT_COLORS[row.requirementLevel] ?? ""}`}>
                          {labels.requirement[row.requirementLevel] ?? row.requirementLevel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level comparison */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("profile.skillsGrid.mine")}</span>
                      <SkillLevelPips rank={row.employeeRank} color={empPipColor} />
                      <span className="ml-auto shrink-0 text-[11px] font-medium">
                        {row.employeeLevelLabel ?? <span className="text-muted-foreground italic">{t("profile.skillsGrid.none")}</span>}
                      </span>
                    </div>
                    {row.requiredRank != null && (
                      <div className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("profile.skillsGrid.target")}</span>
                        <SkillLevelPips rank={row.requiredRank} color="#94a3b8" />
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {row.requiredLevelLabel ?? t("profile.na")}
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
  const { t, i18n } = useTranslation(["employees", "common"]);
  const labels = useEmployeeLabels();
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
            <CardTitle>{t("profile.sections.skillEvolution")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{t("profile.evolution.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          <CardTitle>{t("profile.sections.skillEvolution")}</CardTitle>
          <span className="text-xs font-normal text-muted-foreground">{t("profile.evolution.eventCount", { count: history.length })}</span>
          {improvements > 0 && (
            <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {t("profile.evolution.improvementCount", { count: improvements })}
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
                            {labels.domain[entry.skill.domain] ?? entry.skill.domain}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(entry.effectiveDate, i18n.language, t("common:notAvailable"))}</span>
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
                              {labels.proficiency[entry.previousLevel] ?? entry.previousLevel}
                            </span>
                          </div>
                          <span className="text-muted-foreground">→</span>
                        </>
                      )}
                      {entry.newLevel && (
                        <div className="flex flex-col items-start gap-1">
                          <SkillLevelPips rank={newRank} color={levelColor} />
                          <span className="text-[10px] font-medium">
                            {labels.proficiency[entry.newLevel] ?? entry.newLevel}
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
  const { t } = useTranslation("employees");
  const reviews = useEmployeePerformanceReviews(employeeId);
  const recent = reviews.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("profile.sections.recentPerformance")}</CardTitle>
          <Link href="/performance-reviews" className="text-xs text-primary hover:underline">{t("profile.performance.viewAll")}</Link>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("profile.performance.empty")}</p>
        ) : (
          <div className="space-y-3">
            {recent.map((review) => (
              <Link key={review.id} href="/performance-reviews">
                <div className="rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">{review.reviewDate}</span>
                    <span className="text-xs text-muted-foreground">{t("profile.performance.by", { name: review.reviewerName })}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span><span className="text-muted-foreground">{t("profile.performance.manager")} </span>{review.managerRating} - {PERFORMANCE_RATING_LABELS[review.managerRating]}</span>
                    <span><span className="text-muted-foreground">{t("profile.performance.self")} </span>{review.selfRating} - {PERFORMANCE_RATING_LABELS[review.selfRating]}</span>
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
  const { t } = useTranslation("employees");
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
                <CardTitle>{t("profile.sections.engagementHistory")}</CardTitle>
                {reviews.length > 0 && <Badge variant="secondary">{reviews.length}</Badge>}
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("profile.engagement.empty")}</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">{review.reviewDate}</span>
                    <span className="text-xs text-muted-foreground">{t("profile.performance.by", { name: review.reviewerName })}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <SatisfactionLine label={t("profile.engagement.environment")} score={review.environmentSatisfaction} />
                    <SatisfactionLine label={t("profile.engagement.job")} score={review.jobSatisfaction} />
                    <SatisfactionLine label={t("profile.engagement.relationship")} score={review.relationshipSatisfaction} />
                    <SatisfactionLine label={t("profile.engagement.workLife")} score={review.workLifeBalance} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("profile.engagement.trainingTaken")} <span className="font-semibold text-foreground">{review.trainingOpportunitiesTaken}</span>
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
