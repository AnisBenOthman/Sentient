import { useState, useEffect } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { employees, leaveRequests, skillHistory, employeeExtras, salaryHistory as empSalaryHistory } from "@/lib/mock-data";
import { getOverride, setOverride, getSkillsOverride, setSkillsOverride } from "@/lib/employee-store";
import {
  useEmployeePerformanceReviews,
  PERFORMANCE_RATING_LABELS,
} from "@/lib/performance-review-store";
import { getSkillsGap } from "@/lib/positions-api";
import type { SkillsGapResult } from "@/lib/mock-data";
import { useDepartmentNames } from "@/lib/org-structure-store";
import {
  ArrowLeft,
  Mail,
  Briefcase,
  Calendar,
  Building,
  DollarSign,
  UserCheck,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Zap,
  Phone,
  Heart,
  GraduationCap,
  Award,
  TrendingUp,
  Hash,
  Users,
  Star,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUSES = ["active", "on-leave", "remote", "inactive"];

function statusVariant(status: string) {
  switch (status) {
    case "active":
      return "default";
    case "on-leave":
      return "destructive";
    case "remote":
      return "secondary";
    default:
      return "outline";
  }
}

function leaveStatusVariant(status: string) {
  switch (status) {
    case "Approved":
      return "default";
    case "Rejected":
      return "destructive";
    case "Pending":
      return "secondary";
    default:
      return "outline";
  }
}

export default function EmployeeProfile() {
  const params = useParams<{ id: string }>();
  const original = employees.find((e) => e.id === params.id);
  const DEPARTMENTS = useDepartmentNames();

  const [editMode, setEditMode] = useState(false);

  // Skills state — initialised from localStorage, falling back to mock data
  const [skills, setSkills] = useState<{ skill: string; level: number }[]>(
    () => (original ? (getSkillsOverride(original.id) ?? original.skills ?? []) : [])
  );

  // Persist skills to localStorage whenever they change
  useEffect(() => {
    if (original) {
      setSkillsOverride(original.id, skills);
    }
  }, [skills]);

  // Skills gap — fetched from API
  const [skillsGap, setSkillsGap] = useState<SkillsGapResult | null>(null);
  useEffect(() => {
    if (!original) return;
    getSkillsGap(original.id)
      .then(setSkillsGap)
      .catch(() => setSkillsGap(null));
  }, [original?.id]);
  const [editingSkillIdx, setEditingSkillIdx] = useState<number | null>(null);
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState(70);

  // Skill evolution
  const history = original ? (skillHistory[original.id] ?? []) : [];
  const allHistorySnapshots = history.map((s) => s.label);
  const [fromSnap, setFromSnap] = useState(allHistorySnapshots[0] ?? "");
  const [toSnap, setToSnap] = useState(allHistorySnapshots[allHistorySnapshots.length - 1] ?? "");

  const fromData = history.find((s) => s.label === fromSnap);
  const toData = history.find((s) => s.label === toSnap);

  const CHART_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#0ea5e9"];

  const allSkillNames = fromData && toData
    ? Array.from(new Set([...Object.keys(fromData.skills), ...Object.keys(toData.skills)]))
    : [];

  const fromIdx = history.findIndex((s) => s.label === fromSnap);
  const toIdx = history.findIndex((s) => s.label === toSnap);
  const slicedHistory = fromIdx !== -1 && toIdx !== -1 && fromIdx <= toIdx
    ? history.slice(fromIdx, toIdx + 1)
    : history;

  const lineChartData = slicedHistory.map((snap) => {
    const row: Record<string, unknown> = { label: snap.label };
    allSkillNames.forEach((sk) => { row[sk] = snap.skills[sk] ?? null; });
    return row;
  });

  const diffRows = allSkillNames.map((sk) => {
    const before = fromData?.skills[sk] ?? 0;
    const after = toData?.skills[sk] ?? 0;
    return { skill: sk, before, after, delta: after - before };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const levelLabel = (v: number) =>
    ["", "Beginner", "Developing", "Proficient", "Advanced", "Expert"][v] ?? "";
  const levelColor = (v: number) =>
    ["", "#6b7280", "#ea580c", "#2563eb", "#7c3aed", "#16a34a"][v] ?? "#9ca3af";
  const levelBg = (v: number) =>
    ["", "#f3f4f6", "#fff7ed", "#eff6ff", "#f5f3ff", "#f0fdf4"][v] ?? "#f9fafb";

  const extra = original ? (employeeExtras[original.id] ?? null) : null;
  const empSalary = original ? (empSalaryHistory[original.id] ?? []) : [];
  const salaryChartData = empSalary.map((s) => ({
    date: s.effectiveDate.slice(0, 7),
    gross: s.newGross,
    raise: s.raisePercentage,
    reason: s.reason,
    comment: s.comment,
  }));

  const REASON_LABELS: Record<string, string> = {
    PROMOTION: "Promotion",
    ANNUAL_REVIEW: "Annual Review",
    NEW_FUNCTION: "New Function",
    OTHER: "Other",
  };
  const REASON_COLORS: Record<string, string> = {
    PROMOTION: "#7c3aed",
    ANNUAL_REVIEW: "#2563eb",
    NEW_FUNCTION: "#16a34a",
    OTHER: "#6b7280",
  };
  const CONTRACT_LABELS: Record<string, string> = {
    FULL_TIME: "Full Time",
    PART_TIME: "Part Time",
    INTERN: "Intern",
    CONTRACTOR: "Contractor",
    FIXED_TERM: "Fixed Term",
  };
  const POSITION_LEVEL_LABELS: Record<string, string> = {
    JUNIOR: "Junior",
    MEDIUM: "Medium",
    CONFIRMED: "Confirmed",
    SENIOR_1: "Senior I",
    SENIOR_2: "Senior II",
    EXPERT: "Expert",
  };

  const storedOverride = original ? getOverride(original.id) : null;

  const effectiveEmployeeCode = extra?.employeeCode ?? storedOverride?.employeeCode ?? null;
  const effectiveDateOfBirth = extra?.dateOfBirth ?? storedOverride?.dateOfBirth ?? null;
  const effectiveNetSalary = extra?.netSalary ?? storedOverride?.netSalary ?? null;
  const effectiveIsKeyPosition = extra?.isKeyPosition ?? false;

  const initialFields = original
    ? {
        name: storedOverride?.name ?? original.name,
        role: storedOverride?.role ?? original.role,
        department: storedOverride?.department ?? original.department,
        status: storedOverride?.status ?? original.status,
        phone: storedOverride?.phone ?? extra?.phone ?? "",
        contractType: storedOverride?.contractType ?? extra?.contractType ?? "FULL_TIME",
        positionLevel: storedOverride?.positionLevel ?? extra?.positionLevel ?? "JUNIOR",
        maritalStatus: storedOverride?.maritalStatus ?? extra?.maritalStatus ?? "SINGLE",
        educationLevel: storedOverride?.educationLevel ?? extra?.educationLevel ?? "BACHELOR",
        educationField: storedOverride?.educationField ?? extra?.educationField ?? "",
        team: storedOverride?.team ?? extra?.team ?? "",
      }
    : null;

  const [draft, setDraft] = useState(initialFields);
  const [saved, setSaved] = useState(initialFields);

  if (!original || !draft || !saved) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-2xl font-bold mb-2">Employee Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The requested employee could not be found.
        </p>
        <Link href="/employees">
          <Button>Back to Directory</Button>
        </Link>
      </div>
    );
  }

  const employee = { ...original, ...saved };
  const employeeLeaves = leaveRequests.filter(
    (r) => r.employeeId === employee.id
  );
  const directReports = employees.filter((e) => e.managerId === employee.id);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  function handleSave() {
    if (draft) {
      setSaved({ ...draft });
      setOverride(original!.id, { ...draft });
    }
    setEditMode(false);
  }

  function handleCancel() {
    if (saved) setDraft({ ...saved });
    setEditMode(false);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link href="/employees">
          <Button
            variant="ghost"
            className="mb-4 gap-2 pl-0 hover:bg-transparent"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Button>
        </Link>
      </div>

      {/* Header Profile Section */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
            <AvatarFallback className="text-3xl bg-primary/10 text-primary">
              {getInitials(saved.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              data-testid="heading-employee-name"
            >
              {saved.name}
            </h1>
            <p className="text-xl text-muted-foreground mt-1">{saved.role}</p>
            <div className="flex items-center gap-3 mt-3">
              <Badge variant={statusVariant(saved.status)}>
                {saved.status.charAt(0).toUpperCase() + saved.status.slice(1)}
              </Badge>
              <div className="flex items-center text-sm text-muted-foreground gap-1">
                <Building className="h-4 w-4" />
                {saved.department}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          {editMode ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                data-testid="button-cancel-edit"
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                data-testid="button-save-profile"
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setEditMode(true)}
              data-testid="button-edit-profile"
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="pt-2">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="leave-history" data-testid="tab-leave-history">
            Leave History
            {employeeLeaves.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                {employeeLeaves.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="skills" data-testid="tab-skills">
            Skills
            {skills.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2 py-0.5">
                {skills.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="md:col-span-2 space-y-6">

              {/* --- Professional Details --- */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-indigo-500" />
                    <CardTitle>Professional Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-y-6 gap-x-8">

                  {/* Employee Code (read-only) */}
                  {effectiveEmployeeCode && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Hash className="h-4 w-4" /> Employee Code
                      </p>
                      <p className="font-mono text-sm font-medium">{effectiveEmployeeCode}</p>
                    </div>
                  )}

                  {/* Full Name */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <UserCheck className="h-4 w-4" /> Full Name
                    </Label>
                    {editMode ? (
                      <Input value={draft.name} onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })} data-testid="input-name" />
                    ) : (
                      <p className="font-medium" data-testid="text-name">{saved.name}</p>
                    )}
                  </div>

                  {/* Role */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> Job Title
                    </Label>
                    {editMode ? (
                      <Input value={draft.role} onChange={(e) => setDraft((d) => d && { ...d, role: e.target.value })} data-testid="input-role" />
                    ) : (
                      <p className="font-medium" data-testid="text-role">{saved.role}</p>
                    )}
                  </div>

                  {/* Position Level */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Award className="h-4 w-4" /> Position Level
                    </Label>
                    {editMode ? (
                      <Select value={draft.positionLevel} onValueChange={(v) => setDraft((d) => d && { ...d, positionLevel: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(POSITION_LEVEL_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium">{POSITION_LEVEL_LABELS[saved.positionLevel] ?? saved.positionLevel}</p>
                    )}
                  </div>

                  {/* Contract Type */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> Contract Type
                    </Label>
                    {editMode ? (
                      <Select value={draft.contractType} onValueChange={(v) => setDraft((d) => d && { ...d, contractType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CONTRACT_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium">{CONTRACT_LABELS[saved.contractType] ?? saved.contractType}</p>
                    )}
                  </div>

                  {/* Department */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Building className="h-4 w-4" /> Department
                    </Label>
                    {editMode ? (
                      <Select value={draft.department} onValueChange={(v) => setDraft((d) => d && { ...d, department: v })}>
                        <SelectTrigger data-testid="select-department"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((dep) => <SelectItem key={dep} value={dep}>{dep}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium" data-testid="text-department">{saved.department}</p>
                    )}
                  </div>

                  {/* Team */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" /> Team
                    </Label>
                    {editMode ? (
                      <Input value={draft.team} onChange={(e) => setDraft((d) => d && { ...d, team: e.target.value })} placeholder="Team name" />
                    ) : (
                      <p className="font-medium">{saved.team || "—"}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <UserCheck className="h-4 w-4" /> Status
                    </Label>
                    {editMode ? (
                      <Select value={draft.status} onValueChange={(v) => setDraft((d) => d && { ...d, status: v })}>
                        <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div data-testid="text-status">
                        <Badge variant={statusVariant(saved.status)}>
                          {saved.status.charAt(0).toUpperCase() + saved.status.slice(1)}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Manager (read-only, linked) */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <UserCheck className="h-4 w-4" /> Reports To
                    </p>
                    {employee.managerId ? (
                      <Link href={`/employees/${employee.managerId}`} data-testid="link-manager">
                        <span className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">{employee.manager}</span>
                      </Link>
                    ) : (
                      <p className="font-medium">—</p>
                    )}
                  </div>

                  {/* Hire Date (read-only) */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Hire Date
                    </p>
                    <p className="font-medium">{employee.hireDate}</p>
                  </div>

                  {/* Key Position badge */}
                  {effectiveIsKeyPosition && (
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Star className="h-4 w-4" /> Key Position
                      </p>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Star className="h-3 w-3" /> Designated Key Position
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* --- Personal Information --- */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-rose-500" />
                    <CardTitle>Personal Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-y-6 gap-x-8">

                  {/* Email */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </p>
                    <p className="font-medium" data-testid="text-email">{employee.email}</p>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Phone
                    </Label>
                    {editMode ? (
                      <Input value={draft.phone} onChange={(e) => setDraft((d) => d && { ...d, phone: e.target.value })} placeholder="+1 555-0000" />
                    ) : (
                      <p className="font-medium">{saved.phone || "—"}</p>
                    )}
                  </div>

                  {/* Date of Birth (read-only) */}
                  {effectiveDateOfBirth && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> Date of Birth
                      </p>
                      <p className="font-medium">{effectiveDateOfBirth}</p>
                    </div>
                  )}

                  {/* Marital Status */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Heart className="h-4 w-4" /> Marital Status
                    </Label>
                    {editMode ? (
                      <Select value={draft.maritalStatus} onValueChange={(v) => setDraft((d) => d && { ...d, maritalStatus: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["SINGLE","MARRIED","DIVORCED","WIDOWED"].map((s) => (
                            <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium">{saved.maritalStatus.charAt(0) + saved.maritalStatus.slice(1).toLowerCase()}</p>
                    )}
                  </div>

                  {/* Education Level */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" /> Education Level
                    </Label>
                    {editMode ? (
                      <Select value={draft.educationLevel} onValueChange={(v) => setDraft((d) => d && { ...d, educationLevel: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["BELOW_COLLEGE","COLLEGE","BACHELOR","MASTER","DOCTOR"].map((s) => (
                            <SelectItem key={s} value={s}>{s.replace("_", " ").charAt(0) + s.replace("_", " ").slice(1).toLowerCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="font-medium">{saved.educationLevel.replace("_", " ").charAt(0) + saved.educationLevel.replace("_"," ").slice(1).toLowerCase()}</p>
                    )}
                  </div>

                  {/* Education Field */}
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" /> Field of Study
                    </Label>
                    {editMode ? (
                      <Input value={draft.educationField} onChange={(e) => setDraft((d) => d && { ...d, educationField: e.target.value })} placeholder="e.g. Computer Science" />
                    ) : (
                      <p className="font-medium">{saved.educationField || "—"}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* --- Compensation --- */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <CardTitle>Compensation</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-4 mb-6">
                    <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-4">
                      <p className="text-xs text-muted-foreground font-medium mb-1">Gross Salary</p>
                      <p className="text-xl font-bold text-green-700 dark:text-green-400">${employee.salary.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">per year</p>
                    </div>
                    {effectiveNetSalary !== null && (
                      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Net Salary</p>
                        <p className="text-xl font-bold text-blue-700 dark:text-blue-400">${effectiveNetSalary.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">per year (est.)</p>
                      </div>
                    )}
                    {empSalary.length > 0 && (
                      <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-4">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Last Raise</p>
                        <p className="text-xl font-bold text-purple-700 dark:text-purple-400">+{empSalary[empSalary.length - 1].raisePercentage.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{empSalary[empSalary.length - 1].effectiveDate.slice(0, 7)}</p>
                      </div>
                    )}
                  </div>

                  {/* Salary History Chart */}
                  {salaryChartData.length > 0 && (
                    <>
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Salary History</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={salaryChartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
                          <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                            formatter={(value: number, _: string, entry: { payload?: { reason?: string; raise?: number; comment?: string } }) => [
                              `$${value.toLocaleString()} (+${entry.payload?.raise?.toFixed(1)}%)`,
                              REASON_LABELS[entry.payload?.reason ?? ""] ?? "Salary"
                            ]}
                          />
                          <Bar dataKey="gross" radius={[4,4,0,0]}>
                            {salaryChartData.map((entry, i) => (
                              <Cell key={i} fill={REASON_COLORS[entry.reason] ?? "#6366f1"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 mt-3">
                        {Object.entries(REASON_COLORS).map(([k, color]) => (
                          empSalary.some((s) => s.reason === k) && (
                            <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                              {REASON_LABELS[k]}
                            </span>
                          )
                        ))}
                      </div>

                      {/* Salary History Table */}
                      <div className="mt-4 space-y-2">
                        {[...empSalary].reverse().map((entry, i) => (
                          <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-900/40">
                            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: REASON_COLORS[entry.reason] ?? "#6366f1" }} />
                            <span className="text-xs text-muted-foreground w-20 shrink-0">{entry.effectiveDate.slice(0, 7)}</span>
                            <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">{entry.comment}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: REASON_COLORS[entry.reason] + "1a", color: REASON_COLORS[entry.reason] }}>
                              {REASON_LABELS[entry.reason]}
                            </span>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold">${entry.newGross.toLocaleString()}</p>
                              <p className="text-xs text-green-600 font-semibold">+{entry.raisePercentage.toFixed(1)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Right Column */}
            <div className="space-y-6">

              {/* Direct Reports */}
              {directReports.length > 0 && (
                <Card data-testid="card-direct-reports">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-500" />
                      <CardTitle>Direct Reports</CardTitle>
                      <span className="ml-auto rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs font-semibold px-2 py-0.5">
                        {directReports.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {directReports.map((report) => (
                      <Link
                        key={report.id}
                        href={`/employees/${report.id}`}
                        data-testid={`link-direct-report-${report.id}`}
                      >
                        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(report.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{report.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{report.role}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building className="h-3 w-3" />
                              {report.department}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Leave Balance */}
              <Card>
                <CardHeader>
                  <CardTitle>Leave Balance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b">
                    <div>
                      <p className="font-medium">Annual Leave</p>
                      <p className="text-sm text-muted-foreground">Accrued</p>
                    </div>
                    <div className="text-2xl font-bold">14<span className="text-sm font-normal text-muted-foreground ml-1">days</span></div>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b">
                    <div>
                      <p className="font-medium">Sick Leave</p>
                      <p className="text-sm text-muted-foreground">Available</p>
                    </div>
                    <div className="text-2xl font-bold">8<span className="text-sm font-normal text-muted-foreground ml-1">days</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    <CardTitle>Quick Stats</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Tenure</span>
                    <span className="font-semibold">
                      {(() => {
                        const hire = new Date(employee.hireDate);
                        const now = new Date();
                        const years = now.getFullYear() - hire.getFullYear();
                        const months = now.getMonth() - hire.getMonth();
                        const totalMonths = years * 12 + months;
                        const y = Math.floor(totalMonths / 12);
                        const m = totalMonths % 12;
                        return y > 0 ? `${y}y ${m}m` : `${m}m`;
                      })()}
                    </span>
                  </div>
                  {extra && (
                    <>
                      <div className="flex justify-between items-center text-sm border-t pt-3">
                        <span className="text-muted-foreground">Contract</span>
                        <span className="font-semibold">{CONTRACT_LABELS[saved.contractType] ?? saved.contractType}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t pt-3">
                        <span className="text-muted-foreground">Level</span>
                        <span className="font-semibold">{POSITION_LEVEL_LABELS[saved.positionLevel] ?? saved.positionLevel}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t pt-3">
                        <span className="text-muted-foreground">Salary reviews</span>
                        <span className="font-semibold">{empSalary.length}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Recent Performance */}
              <RecentPerformanceCard employeeId={employee.id} />

              {/* Engagement History */}
              <EngagementHistoryCard employeeId={employee.id} />

            </div>
          </div>
        </TabsContent>

        {/* Leave History Tab */}
        <TabsContent value="leave-history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave Request History</CardTitle>
            </CardHeader>
            <CardContent>
              {employeeLeaves.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Calendar className="mx-auto h-10 w-10 mb-3 opacity-40" />
                  <p>No leave requests found for this employee.</p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="leave-history-list">
                  {employeeLeaves.map((leave) => (
                    <div
                      key={leave.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                      data-testid={`leave-item-${leave.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{leave.type} Leave</span>
                          <Badge variant={leaveStatusVariant(leave.status)}>
                            {leave.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {leave.startDate} → {leave.endDate}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold">
                          {leave.daysCount}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            days
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Skills Tab */}
        <TabsContent value="skills" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <CardTitle>Skills & Proficiency</CardTitle>
              </div>
              {!addingSkill && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setAddingSkill(true);
                    setNewSkillName("");
                    setNewSkillLevel(70);
                  }}
                  data-testid="button-add-skill"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Skill
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add skill inline form */}
              {addingSkill && (
                <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-3"
                  data-testid="form-add-skill">
                  <Input
                    placeholder="e.g. React, Leadership, Excel…"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    className="w-full"
                    data-testid="input-skill-name"
                    autoFocus
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Proficiency level</Label>
                    <div className="flex gap-2" data-testid="slider-skill-level">
                      {([
                        { level: 1, text: "Beginner",   bg: "#f3f4f6", active: "#6b7280", ring: "#6b7280" },
                        { level: 2, text: "Developing",  bg: "#fff7ed", active: "#ea580c", ring: "#ea580c" },
                        { level: 3, text: "Proficient",  bg: "#eff6ff", active: "#2563eb", ring: "#2563eb" },
                        { level: 4, text: "Advanced",    bg: "#f5f3ff", active: "#7c3aed", ring: "#7c3aed" },
                        { level: 5, text: "Expert",      bg: "#f0fdf4", active: "#16a34a", ring: "#16a34a" },
                      ] as const).map(({ level, text, bg, active, ring }) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setNewSkillLevel(level)}
                          className="flex-1 py-1.5 rounded-full text-[11px] font-semibold transition-all border-2"
                          style={newSkillLevel === level
                            ? { background: bg, color: active, borderColor: ring }
                            : { background: "transparent", color: "#9ca3af", borderColor: "#e5e7eb" }
                          }
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddingSkill(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!newSkillName.trim()}
                      onClick={() => {
                        if (!newSkillName.trim()) return;
                        setSkills((prev) => [
                          ...prev,
                          { skill: newSkillName.trim(), level: newSkillLevel },
                        ]);
                        setAddingSkill(false);
                      }}
                      data-testid="button-save-skill"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Skills radar chart */}
              {skills.length === 0 && !addingSkill ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Zap className="mx-auto h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">No skills recorded yet.</p>
                  <p className="text-xs mt-1">Click "Add Skill" to get started.</p>
                </div>
              ) : (
                <>
                  {(() => {
                    // Build radar data — merge employee skills with position required levels
                    const radarData = skillsGap && skillsGap.items.length >= 3
                      ? skillsGap.items.map((item) => ({
                          skill: item.skill.name,
                          level: item.acquiredProficiency ?? 0,
                          required: item.requiredProficiency,
                        }))
                      : skills.length >= 3
                        ? skills.map((s) => ({ skill: s.skill, level: s.level, required: undefined }))
                        : null;

                    if (!radarData) return null;
                    const showRoleOverlay = radarData.some((d) => d.required !== undefined);

                    return (
                      <div className="w-full" data-testid="skills-radar">
                        {showRoleOverlay && (
                          <div className="flex items-center justify-center gap-5 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#3b82f6" }} />
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">My Proficiency</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#f59e0b" }} />
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                Role Required{skillsGap?.positionTitle ? ` (${skillsGap.positionTitle})` : ""}
                              </span>
                            </div>
                          </div>
                        )}
                        <ResponsiveContainer width="100%" height={280}>
                          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                            <PolarGrid stroke="currentColor" className="text-gray-200 dark:text-gray-700" />
                            <PolarAngleAxis
                              dataKey="skill"
                              tick={{ fontSize: 11, fill: "currentColor" }}
                              className="text-gray-500 dark:text-gray-400"
                            />
                            <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                            {showRoleOverlay && (
                              <Radar
                                name="Role Required"
                                dataKey="required"
                                stroke="#f59e0b"
                                fill="#f59e0b"
                                fillOpacity={0.12}
                                strokeWidth={2}
                                strokeDasharray="5 3"
                                dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                              />
                            )}
                            <Radar
                              name="My Proficiency"
                              dataKey="level"
                              stroke="#3b82f6"
                              fill="#3b82f6"
                              fillOpacity={0.25}
                              strokeWidth={2}
                              dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                value ? `${value}/5` : "—",
                                name === "level" ? "My Proficiency" : name === "required" ? "Role Required" : name,
                              ]}
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
                    );
                  })()}

                  {/* Compact editable list */}
                  <div className="space-y-1.5" data-testid="skills-list">
                    {skills.map((s, idx) => (
                      <div key={idx} data-testid={`skill-item-${idx}`}>
                        {editingSkillIdx === idx ? (
                          <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/10 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium flex-1">{s.skill}</span>
                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                                style={{
                                  background: ["#f3f4f6","#fff7ed","#eff6ff","#f5f3ff","#f0fdf4"][s.level - 1],
                                  color: ["#6b7280","#ea580c","#2563eb","#7c3aed","#16a34a"][s.level - 1],
                                }}>
                                {["Beginner","Developing","Proficient","Advanced","Expert"][s.level - 1]}
                              </span>
                            </div>
                            <div className="flex gap-2" data-testid={`slider-edit-skill-${idx}`}>
                              {([
                                { level: 1, text: "Beginner",  bg: "#f3f4f6", active: "#6b7280", ring: "#6b7280" },
                                { level: 2, text: "Developing",bg: "#fff7ed", active: "#ea580c", ring: "#ea580c" },
                                { level: 3, text: "Proficient",bg: "#eff6ff", active: "#2563eb", ring: "#2563eb" },
                                { level: 4, text: "Advanced",  bg: "#f5f3ff", active: "#7c3aed", ring: "#7c3aed" },
                                { level: 5, text: "Expert",    bg: "#f0fdf4", active: "#16a34a", ring: "#16a34a" },
                              ] as const).map(({ level, text, bg, active, ring }) => (
                                <button
                                  key={level}
                                  type="button"
                                  onClick={() => setSkills((prev) => prev.map((sk, i) => i === idx ? { ...sk, level } : sk))}
                                  className="flex-1 py-1 rounded-full text-[11px] font-semibold transition-all border-2"
                                  style={s.level === level
                                    ? { background: bg, color: active, borderColor: ring }
                                    : { background: "transparent", color: "#9ca3af", borderColor: "#e5e7eb" }
                                  }
                                >
                                  {text}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-end">
                              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setEditingSkillIdx(null)}>
                                Done
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-colors">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">
                              {s.skill}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {(() => {
                                const labels: Record<number, { text: string; bg: string; color: string }> = {
                                  1: { text: "Beginner",    bg: "#f3f4f6", color: "#6b7280" },
                                  2: { text: "Developing",  bg: "#fff7ed", color: "#ea580c" },
                                  3: { text: "Proficient",  bg: "#eff6ff", color: "#2563eb" },
                                  4: { text: "Advanced",    bg: "#f5f3ff", color: "#7c3aed" },
                                  5: { text: "Expert",      bg: "#f0fdf4", color: "#16a34a" },
                                };
                                const l = labels[s.level] ?? labels[3];
                                return (
                                  <span
                                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                                    style={{ background: l.bg, color: l.color }}
                                  >
                                    {l.text}
                                  </span>
                                );
                              })()}
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  onClick={() => setEditingSkillIdx(idx)}
                                  title="Edit level"
                                  data-testid={`button-edit-skill-${idx}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  onClick={() => setSkills((prev) => prev.filter((_, i) => i !== idx))}
                                  title="Remove skill"
                                  data-testid={`button-remove-skill-${idx}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Skills Gap Panel ─────────────────────────────────────────── */}
          {skillsGap && (() => {
            const gap = skillsGap;

            const PROF_LABELS = ["", "Beginner", "Developing", "Proficient", "Advanced", "Expert"];
            const PROF_COLORS = ["", "#6b7280", "#ea580c", "#2563eb", "#7c3aed", "#16a34a"];

            function ProfBar({ level, max = 5, color }: { level: number; max?: number; color: string }) {
              return (
                <div className="flex gap-0.5">
                  {Array.from({ length: max }).map((_, i) => (
                    <div key={i} className="h-1.5 flex-1 rounded-sm" style={{ background: i < level ? color : "#e5e7eb" }} />
                  ))}
                </div>
              );
            }

            const borderColor = (item: SkillsGapResult["items"][0]) => {
              if (item.status === "EXCEEDS") return "#6366f1";
              if (item.status === "MET")     return "#22c55e";
              if (item.status === "PARTIAL") return "#f59e0b";
              if (item.status === "MISSING" && item.requirementLevel === "MANDATORY") return "#ef4444";
              return "#f59e0b";
            };

            const statusLabel = (item: SkillsGapResult["items"][0]) => {
              switch (item.status) {
                case "EXCEEDS": return { text: "Exceeds", bg: "#eef2ff", color: "#4f46e5" };
                case "MET":     return { text: "Met",     bg: "#f0fdf4", color: "#16a34a" };
                case "PARTIAL": return { text: "Partial", bg: "#fffbeb", color: "#d97706" };
                case "MISSING": return item.requirementLevel === "MANDATORY"
                  ? { text: "Missing", bg: "#fef2f2", color: "#dc2626" }
                  : { text: "Missing", bg: "#fffbeb", color: "#d97706" };
              }
            };

            return (
              <Card className="mt-4" data-testid="card-skills-gap">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-indigo-500" />
                    <CardTitle>Skills Gap</CardTitle>
                    {gap.positionTitle && (
                      <span className="ml-auto text-xs text-muted-foreground font-normal">
                        vs. <span className="font-semibold text-gray-700 dark:text-gray-300">{gap.positionTitle}</span>
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Summary stat boxes */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-center">
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">{gap.summary.met}</p>
                      <p className="text-xs text-green-600 dark:text-green-500 font-medium mt-0.5">Met / Exceeds</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{gap.summary.partial}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-0.5">Partial / Missing</p>
                    </div>
                    <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3 text-center">
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{gap.summary.exceeds}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-500 font-medium mt-0.5">Exceeds</p>
                    </div>
                  </div>

                  {/* Gap table */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto_80px_80px_80px] gap-x-3 px-3 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Skill</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Category</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Required</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Acquired</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                    </div>
                    {gap.items.map((item, idx) => {
                      const reqColor = PROF_COLORS[item.requiredProficiency];
                      const acqColor = item.acquiredProficiency ? PROF_COLORS[item.acquiredProficiency] : "#9ca3af";
                      const bc = borderColor(item);
                      const sl = statusLabel(item);
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr_auto_80px_80px_80px] gap-x-3 items-center px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border-l-4"
                          style={{ borderLeftColor: bc }}
                          data-testid={`gap-item-${idx}`}
                        >
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.skill.name}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {item.skill.category.charAt(0) + item.skill.category.slice(1).toLowerCase()}
                          </span>
                          <div className="space-y-1">
                            <ProfBar level={item.requiredProficiency} color={reqColor} />
                            <p className="text-[10px]" style={{ color: reqColor }}>{PROF_LABELS[item.requiredProficiency]}</p>
                          </div>
                          <div className="space-y-1">
                            {item.acquiredProficiency !== null ? (
                              <>
                                <ProfBar level={item.acquiredProficiency} color={acqColor} />
                                <p className="text-[10px]" style={{ color: acqColor }}>{PROF_LABELS[item.acquiredProficiency]}</p>
                              </>
                            ) : (
                              <p className="text-sm text-gray-400">—</p>
                            )}
                          </div>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: sl?.bg, color: sl?.color }}
                          >
                            {sl?.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Skill Evolution Card */}
          {history.length >= 2 && (
            <Card className="mt-4">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l4-8 4 4 4-6 4 5"/><path d="M3 21h18"/></svg>
                    <CardTitle>Skill Evolution</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground font-medium">From</span>
                    <Select value={fromSnap} onValueChange={setFromSnap}>
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allHistorySnapshots.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground font-medium">to</span>
                    <Select value={toSnap} onValueChange={setToSnap}>
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allHistorySnapshots.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Line chart showing all skills over all snapshots */}
                <div className="mb-6">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={lineChartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <YAxis domain={[0, 5]} ticks={[1,2,3,4,5]} tick={{ fontSize: 11, fill: "#6b7280" }}
                        tickFormatter={(v) => ["","B","D","P","A","E"][v] ?? ""} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                        formatter={(value: number, name: string) => [
                          `${levelLabel(value)} (${value}/5)`, name
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      {allSkillNames.map((sk, i) => (
                        <Line
                          key={sk}
                          type="monotone"
                          dataKey={sk}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3.5, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Before / After comparison table */}
                {fromData && toData && fromSnap !== toSnap && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Changes: {fromSnap} → {toSnap}
                    </p>
                    <div className="space-y-2">
                      {diffRows.map(({ skill, before, after, delta }) => (
                        <div key={skill} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-50 dark:bg-gray-900/40">
                          <span className="w-28 text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{skill}</span>
                          {/* Before pill */}
                          <span
                            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ background: levelBg(before), color: levelColor(before) }}
                          >
                            {levelLabel(before) || "—"}
                          </span>
                          {/* Arrow + delta */}
                          <div className="flex-1 flex items-center gap-1.5">
                            {delta === 0 ? (
                              <span className="text-gray-400 text-xs">— no change</span>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                <span
                                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                                  style={{ background: levelBg(after), color: levelColor(after) }}
                                >
                                  {levelLabel(after)}
                                </span>
                                <span
                                  className="ml-1 text-xs font-bold"
                                  style={{ color: delta > 0 ? "#16a34a" : "#dc2626" }}
                                >
                                  {delta > 0 ? `+${delta}` : delta}
                                </span>
                              </>
                            )}
                          </div>
                          {/* Progress bar */}
                          <div className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(after / 5) * 100}%`,
                                background: levelColor(after),
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const SATISFACTION_EMOJI: Record<number, string> = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "😊",
  5: "😄",
};

function SatisfactionDot({ score }: { score: number }) {
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];
  return (
    <span
      className="inline-flex items-center gap-1 text-sm font-semibold"
      style={{ color: colors[score] ?? "#6b7280" }}
    >
      {SATISFACTION_EMOJI[score] ?? "—"} {score}/5
    </span>
  );
}

function EngagementHistoryCard({ employeeId }: { employeeId: string }) {
  const reviews = useEmployeePerformanceReviews(employeeId);
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="engagement-history-collapsible">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none hover:bg-accent/30 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">😊</span>
                <span className="font-semibold text-base">Engagement History</span>
                {reviews.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                    {reviews.length}
                  </span>
                )}
              </div>
              <ChevronDown
                className="h-4 w-4 text-muted-foreground transition-transform duration-200"
                style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {reviews.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No engagement data recorded yet.{" "}
                <Link href="/performance-reviews" className="text-primary hover:underline">
                  Add a review
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3" data-testid="engagement-history-list">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border bg-gray-50 dark:bg-gray-800/40 p-3 space-y-2"
                    data-testid={`engagement-review-${r.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {r.reviewDate}
                      </span>
                      <span className="text-xs text-muted-foreground">by {r.reviewerName}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">😊 Environment</span>
                        <SatisfactionDot score={r.environmentSatisfaction} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">💼 Job</span>
                        <SatisfactionDot score={r.jobSatisfaction} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">🤝 Relationship</span>
                        <SatisfactionDot score={r.relationshipSatisfaction} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">⚖️ Work-Life</span>
                        <SatisfactionDot score={r.workLifeBalance} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-xs text-muted-foreground">📚 Training sessions taken:</span>
                      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {r.trainingOpportunitiesTaken}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function RecentPerformanceCard({ employeeId }: { employeeId: string }) {
  const reviews = useEmployeePerformanceReviews(employeeId);
  const recent = reviews.slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Performance</CardTitle>
        <Link
          href="/performance-reviews"
          className="text-xs text-primary hover:underline"
          data-testid="link-all-reviews"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2">
            No performance reviews yet.{" "}
            <Link
              href="/performance-reviews"
              className="text-primary hover:underline"
            >
              Add one
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-3" data-testid="list-recent-reviews">
            {recent.map((r) => (
              <Link
                key={r.id}
                href="/performance-reviews"
                className="block p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
                data-testid={`link-recent-review-${r.id}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{r.reviewDate}</span>
                  <span className="text-xs text-muted-foreground">
                    by {r.reviewerName}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>
                    <span className="text-muted-foreground">Manager: </span>
                    <span className="font-medium">
                      {r.managerRating} — {PERFORMANCE_RATING_LABELS[r.managerRating]}
                    </span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Self: </span>
                    <span className="font-medium">
                      {r.selfRating} — {PERFORMANCE_RATING_LABELS[r.selfRating]}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
