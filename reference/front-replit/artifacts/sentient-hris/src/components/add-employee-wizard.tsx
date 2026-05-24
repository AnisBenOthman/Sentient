import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrgStructure } from "@/lib/org-structure-store";
import { setOverride } from "@/lib/employee-store";
import { type Employee } from "@/lib/mock-data";
import { getPositions, type PositionWithCount } from "@/lib/positions-api";

// ── Enum option lists ────────────────────────────────────────────────────────

const MARITAL_STATUS_OPTS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
];

const EDUCATION_LEVEL_OPTS = [
  { value: "BELOW_COLLEGE", label: "Below College" },
  { value: "COLLEGE", label: "College" },
  { value: "BACHELOR", label: "Bachelor" },
  { value: "MASTER", label: "Master" },
  { value: "DOCTOR", label: "Doctorate" },
];

const EMPLOYMENT_STATUS_OPTS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "PROBATION", label: "Probation" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "RESIGNED", label: "Resigned" },
];

const CONTRACT_TYPE_OPTS = [
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
  { value: "INTERN", label: "Intern" },
  { value: "CONTRACTOR", label: "Contractor (Freelance)" },
  { value: "FIXED_TERM", label: "Fixed Term" },
];

const POSITION_LEVEL_OPTS = [
  { value: "JUNIOR", label: "Junior" },
  { value: "MEDIUM", label: "Medium" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "SENIOR_1", label: "Senior I" },
  { value: "SENIOR_2", label: "Senior II" },
  { value: "EXPERT", label: "Expert" },
];

const STEP_LABELS = ["Personal Info", "Employment", "Organization", "Review"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDisplayStatus(s: string): string {
  switch (s) {
    case "ACTIVE":     return "active";
    case "ON_LEAVE":   return "on-leave";
    case "PROBATION":  return "probation";
    case "TERMINATED": return "terminated";
    case "RESIGNED":   return "resigned";
    default:           return "active";
  }
}

function labelOf(
  opts: { value: string; label: string }[],
  val: string
): string {
  return opts.find((o) => o.value === val)?.label ?? val;
}

// ── Blank form ───────────────────────────────────────────────────────────────

const BLANK_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  maritalStatus: "",
  educationLevel: "",
  educationField: "",
  employeeCode: "",
  hireDate: new Date().toISOString().slice(0, 10),
  employmentStatus: "ACTIVE",
  contractType: "FULL_TIME",
  managerId: "",
  buId: "",
  departmentId: "",
  teamId: "",
  positionId: "",
  role: "",
  positionLevel: "",
  grossSalary: "",
  netSalary: "",
};

// ── Public types ─────────────────────────────────────────────────────────────

// NewEmployee is the full Employee shape — schema-aligned optional fields are
// populated directly on the object so callers receive complete data without
// needing to reach into the override store.
export type NewEmployee = Employee;

type EmployeeListItem = { id: string; name: string };

interface AddEmployeeWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allEmployees: EmployeeListItem[];
  onEmployeeAdded: (emp: Employee) => void;
}

// ── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  current,
  labels,
}: {
  current: number;
  labels: string[];
}) {
  return (
    <div
      className="flex items-start mb-6"
      data-testid="wizard-step-indicator"
    >
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div
            key={stepNum}
            className="flex items-center flex-1 last:flex-none"
          >
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors",
                  done && "bg-green-500 text-white",
                  active &&
                    "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/50",
                  !done &&
                    !active &&
                    "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                )}
                data-testid={`wizard-step-${stepNum}`}
              >
                {done ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-xs font-medium text-center leading-tight whitespace-nowrap",
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : done
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2 mt-[-14px]",
                  done
                    ? "bg-green-400"
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Review summary helpers ───────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground min-w-[130px] flex-shrink-0">
        {label}
      </span>
      <span className="text-gray-900 dark:text-gray-100 font-medium break-all">
        {value}
      </span>
    </div>
  );
}

function SummarySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {title}
      </p>
      <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-1.5">
        {children}
      </div>
    </div>
  );
}

// ── Main wizard ──────────────────────────────────────────────────────────────

export function AddEmployeeWizard({
  open,
  onOpenChange,
  allEmployees,
  onEmployeeAdded,
}: AddEmployeeWizardProps) {
  const { businessUnits, departments, teams } = useOrgStructure();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [positions, setPositions] = useState<PositionWithCount[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);

  useEffect(() => {
    setPositionsLoading(true);
    getPositions()
      .then(setPositions)
      .catch(() => setPositions([]))
      .finally(() => setPositionsLoading(false));
  }, []);

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm({
        ...BLANK_FORM,
        employeeCode: `EMP-${String(Date.now()).slice(-6)}`,
      });
      setErrors({});
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDepts = useMemo(
    () =>
      form.buId
        ? departments.filter((d) => d.buId === form.buId)
        : departments,
    [form.buId, departments]
  );

  const filteredTeams = useMemo(
    () =>
      form.departmentId
        ? teams.filter((t) => t.departmentId === form.departmentId)
        : teams,
    [form.departmentId, teams]
  );

  // Positions filtered by selected department & optionally team
  const filteredPositions = useMemo(() => {
    const deptName = departments.find((d) => d.id === form.departmentId)?.name;
    const teamName = teams.find((t) => t.id === form.teamId)?.name;
    return positions
      .filter((p) => p.isActive !== false)
      .filter((p) => !deptName || p.department === deptName)
      .filter((p) => !teamName || p.team === teamName)
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [positions, form.departmentId, form.teamId, departments, teams]);

  const field = (key: keyof typeof BLANK_FORM, val: string) => {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "buId") {
        next.departmentId = "";
        next.teamId = "";
      }
      if (key === "departmentId") {
        next.teamId = "";
      }
      if (key === "positionId") {
        const pos = positions.find((p) => p.id === val);
        next.role = pos?.title ?? "";
        next.positionLevel = pos?.level ?? "";
      }
      if (key === "departmentId") {
        next.positionId = "";
        next.role = "";
        next.positionLevel = "";
      }
      if (key === "teamId") {
        next.positionId = "";
        next.role = "";
        next.positionLevel = "";
      }
      return next;
    });
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      delete n["role"];
      return n;
    });
  };

  const today = new Date().toISOString().slice(0, 10);

  const validateStep = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.firstName.trim()) e.firstName = "First name is required";
      if (!form.lastName.trim()) e.lastName = "Last name is required";
      if (!form.email.trim()) e.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        e.email = "Enter a valid email";
      if (!form.phone.trim()) e.phone = "Phone is required";
      if (!form.dateOfBirth) e.dateOfBirth = "Date of birth is required";
      else if (form.dateOfBirth >= today) e.dateOfBirth = "Date of birth must be in the past";
      if (!form.maritalStatus) e.maritalStatus = "Marital status is required";
      if (!form.educationLevel) e.educationLevel = "Education level is required";
      if (!form.educationField.trim()) e.educationField = "Education field is required";
    } else if (s === 2) {
      if (!form.employeeCode.trim())
        e.employeeCode = "Employee code is required";
      if (!form.hireDate) e.hireDate = "Hire date is required";
    } else if (s === 3) {
      if (!form.positionId) e.role = "Please select a position";
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, 4));
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = () => {
    const dept = departments.find((d) => d.id === form.departmentId);
    const team = teams.find((t) => t.id === form.teamId);
    const mgr = allEmployees.find((e) => e.id === form.managerId);
    const newId = String(Date.now());
    const resolvedManagerId =
      form.managerId && form.managerId !== "none" ? form.managerId : null;

    // All schema-aligned fields are carried directly on the employee object.
    // toDisplayStatus() is a display-only convenience for the badge renderer;
    // the raw enum value is preserved in employmentStatus.
    const newEmp: Employee = {
      id: newId,
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
      email: form.email.trim(),
      role: form.role.trim(),
      department: dept?.name ?? "",
      status: toDisplayStatus(form.employmentStatus),
      hireDate: form.hireDate,
      salary: form.grossSalary ? Number(form.grossSalary) : 0,
      manager: mgr?.name ?? null,
      managerId: resolvedManagerId,
      buId: form.buId || "other",
      skills: [],
      // Schema-aligned fields — stored on the object (not only in override)
      employmentStatus: form.employmentStatus,
      grossSalary: form.grossSalary ? Number(form.grossSalary) : undefined,
      netSalary: form.netSalary ? Number(form.netSalary) : undefined,
      phone: form.phone || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      maritalStatus: form.maritalStatus || undefined,
      educationLevel: form.educationLevel || undefined,
      educationField: form.educationField || undefined,
      positionLevel: form.positionLevel || undefined,
      contractType: form.contractType,
      employeeCode: form.employeeCode,
      team: team?.name,
    };

    setOverride(newId, {
      name: newEmp.name,
      role: newEmp.role,
      department: newEmp.department,
      status: newEmp.status,
      phone: form.phone,
      contractType: form.contractType,
      positionLevel: form.positionLevel,
      maritalStatus: form.maritalStatus,
      educationLevel: form.educationLevel,
      educationField: form.educationField,
      team: team?.name ?? "",
      employeeCode: form.employeeCode,
      dateOfBirth: form.dateOfBirth,
      netSalary: form.netSalary ? Number(form.netSalary) : undefined,
    });

    onEmployeeAdded(newEmp);
    onOpenChange(false);
  };

  const reviewBu = businessUnits.find((b) => b.id === form.buId);
  const reviewDept = departments.find((d) => d.id === form.departmentId);
  const reviewTeam = teams.find((t) => t.id === form.teamId);
  const reviewMgr = allEmployees.find((e) => e.id === form.managerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[92vh] overflow-y-auto"
        data-testid="dialog-add-employee"
      >
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} labels={STEP_LABELS} />

        <div className="min-h-[320px] space-y-4">
          {/* ── Step 1: Personal Info ─────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4" data-testid="wizard-step-1-content">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name *</Label>
                  <Input
                    placeholder="Jane"
                    value={form.firstName}
                    onChange={(e) => field("firstName", e.target.value)}
                    data-testid="input-first-name"
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-500">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name *</Label>
                  <Input
                    placeholder="Smith"
                    value={form.lastName}
                    onChange={(e) => field("lastName", e.target.value)}
                    data-testid="input-last-name"
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-500">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="jane.smith@company.com"
                  value={form.email}
                  onChange={(e) => field("email", e.target.value)}
                  data-testid="input-new-email"
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone *</Label>
                  <Input
                    placeholder="+1 555-0100"
                    value={form.phone}
                    onChange={(e) => field("phone", e.target.value)}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-500">{errors.phone}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth *</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    max={today}
                    onChange={(e) => field("dateOfBirth", e.target.value)}
                  />
                  {errors.dateOfBirth && (
                    <p className="text-xs text-red-500">{errors.dateOfBirth}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Marital Status *</Label>
                  <Select
                    value={form.maritalStatus}
                    onValueChange={(v) => field("maritalStatus", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARITAL_STATUS_OPTS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.maritalStatus && (
                    <p className="text-xs text-red-500">{errors.maritalStatus}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Education Level *</Label>
                  <Select
                    value={form.educationLevel}
                    onValueChange={(v) => field("educationLevel", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {EDUCATION_LEVEL_OPTS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.educationLevel && (
                    <p className="text-xs text-red-500">{errors.educationLevel}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Education Field *</Label>
                <Input
                  placeholder="e.g. Computer Science"
                  value={form.educationField}
                  onChange={(e) => field("educationField", e.target.value)}
                />
                {errors.educationField && (
                  <p className="text-xs text-red-500">{errors.educationField}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Employment ───────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4" data-testid="wizard-step-2-content">
              <div className="space-y-1.5">
                <Label>Employee Code *</Label>
                <Input
                  placeholder="EMP-001"
                  value={form.employeeCode}
                  onChange={(e) => field("employeeCode", e.target.value)}
                  data-testid="input-employee-code"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-generated — edit if needed.
                </p>
                {errors.employeeCode && (
                  <p className="text-xs text-red-500">{errors.employeeCode}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Hire Date *</Label>
                  <Input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => field("hireDate", e.target.value)}
                    data-testid="input-new-hire-date"
                  />
                  {errors.hireDate && (
                    <p className="text-xs text-red-500">{errors.hireDate}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Employment Status *</Label>
                  <Select
                    value={form.employmentStatus}
                    onValueChange={(v) => field("employmentStatus", v)}
                  >
                    <SelectTrigger data-testid="select-employment-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_STATUS_OPTS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Contract Type *</Label>
                <Select
                  value={form.contractType}
                  onValueChange={(v) => field("contractType", v)}
                >
                  <SelectTrigger data-testid="select-contract-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPE_OPTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Manager</Label>
                <Select
                  value={form.managerId}
                  onValueChange={(v) => field("managerId", v)}
                >
                  <SelectTrigger data-testid="select-new-manager">
                    <SelectValue placeholder="No manager assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {allEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── Step 3: Organization ─────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4" data-testid="wizard-step-3-content">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Business Unit</Label>
                  <Select
                    value={form.buId}
                    onValueChange={(v) => field("buId", v)}
                  >
                    <SelectTrigger data-testid="select-new-bu">
                      <SelectValue placeholder="Select BU…" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessUnits
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((bu) => (
                          <SelectItem key={bu.id} value={bu.id}>
                            {bu.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select
                    value={form.departmentId}
                    onValueChange={(v) => field("departmentId", v)}
                    disabled={filteredDepts.length === 0}
                  >
                    <SelectTrigger data-testid="select-new-department">
                      <SelectValue placeholder="Select dept…" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDepts
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Team</Label>
                <Select
                  value={form.teamId}
                  onValueChange={(v) => field("teamId", v)}
                  disabled={filteredTeams.length === 0}
                >
                  <SelectTrigger data-testid="select-new-team">
                    <SelectValue placeholder="Select team…" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTeams
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Position *</Label>
                <Select
                  value={form.positionId}
                  onValueChange={(v) => field("positionId", v)}
                  disabled={positionsLoading || filteredPositions.length === 0}
                >
                  <SelectTrigger data-testid="select-position">
                    <SelectValue
                      placeholder={
                        positionsLoading
                          ? "Loading positions…"
                          : filteredPositions.length === 0
                          ? form.departmentId
                            ? "No positions for this selection"
                            : "Select a department first…"
                          : "Select a position…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPositions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-medium">{p.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.level}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-xs text-red-500">{errors.role}</p>
                )}
                {form.positionId && (
                  <p className="text-xs text-muted-foreground">
                    Level: <span className="font-medium">{form.positionLevel}</span>
                    {" · "}Role: <span className="font-medium">{form.role}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Compensation & Review ────────────────── */}
          {step === 4 && (
            <div className="space-y-5" data-testid="wizard-step-4-content">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Gross Salary</Label>
                  <Input
                    type="number"
                    placeholder="85000"
                    min="0"
                    value={form.grossSalary}
                    onChange={(e) => field("grossSalary", e.target.value)}
                    data-testid="input-gross-salary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Net Salary</Label>
                  <Input
                    type="number"
                    placeholder="65000"
                    min="0"
                    value={form.netSalary}
                    onChange={(e) => field("netSalary", e.target.value)}
                    data-testid="input-net-salary"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Summary
                </p>

                <SummarySection title="Personal Information">
                  <SummaryRow
                    label="Name"
                    value={
                      [form.firstName, form.lastName]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  />
                  <SummaryRow label="Email" value={form.email} />
                  <SummaryRow label="Phone" value={form.phone} />
                  <SummaryRow label="Date of Birth" value={form.dateOfBirth} />
                  <SummaryRow
                    label="Marital Status"
                    value={
                      form.maritalStatus
                        ? labelOf(MARITAL_STATUS_OPTS, form.maritalStatus)
                        : undefined
                    }
                  />
                  <SummaryRow
                    label="Education"
                    value={
                      form.educationLevel
                        ? `${labelOf(EDUCATION_LEVEL_OPTS, form.educationLevel)}${
                            form.educationField
                              ? ` · ${form.educationField}`
                              : ""
                          }`
                        : undefined
                    }
                  />
                </SummarySection>

                <SummarySection title="Employment">
                  <SummaryRow
                    label="Employee Code"
                    value={form.employeeCode}
                  />
                  <SummaryRow label="Hire Date" value={form.hireDate} />
                  <SummaryRow
                    label="Status"
                    value={labelOf(
                      EMPLOYMENT_STATUS_OPTS,
                      form.employmentStatus
                    )}
                  />
                  <SummaryRow
                    label="Contract"
                    value={labelOf(CONTRACT_TYPE_OPTS, form.contractType)}
                  />
                  <SummaryRow label="Manager" value={reviewMgr?.name} />
                </SummarySection>

                <SummarySection title="Organization">
                  <SummaryRow
                    label="Position"
                    value={
                      form.positionId
                        ? positions.find((p) => p.id === form.positionId)?.title
                        : undefined
                    }
                  />
                  <SummaryRow label="Level" value={form.positionLevel || undefined} />
                  <SummaryRow label="Business Unit" value={reviewBu?.name} />
                  <SummaryRow label="Department" value={reviewDept?.name} />
                  <SummaryRow label="Team" value={reviewTeam?.name} />
                </SummarySection>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between pt-4 border-t mt-2">
          <Button
            variant="outline"
            onClick={step === 1 ? () => onOpenChange(false) : handleBack}
            data-testid="wizard-back-btn"
          >
            {step === 1 ? "Cancel" : "← Back"}
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Step {step} of {STEP_LABELS.length}
            </span>
            <Button
              onClick={step < 4 ? handleNext : handleSubmit}
              data-testid={
                step === 4 ? "button-submit-employee" : "wizard-next-btn"
              }
            >
              {step < 4 ? "Next →" : "Add Employee"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
