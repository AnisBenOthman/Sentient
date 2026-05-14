import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  X,
  Check,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ChevronDown,
  Sparkles,
  Briefcase,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { getRoleTier } from "@/lib/auth";
import { getPositions, type PositionWithCount } from "@/lib/positions-api";
import {
  approvePromotionRequest,
  createPromotionRequest,
  getEmployees,
  getPromotionRequests,
  rejectPromotionRequest,
  type CreatePromotionRequestPayload,
  type EmployeeProfile,
} from "@/lib/api/hr-core";
import { useToast } from "@/hooks/use-toast";

const STEP_LABELS = [
  "Select Employee",
  "New Compensation",
  "Role & Responsibilities",
  "Review & Submit",
];

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function getApiErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: unknown }).response !== null
  ) {
    const data = (error as { response: { data?: unknown } }).response.data;
    if (typeof data === "object" && data !== null && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (Array.isArray(message)) return message.filter((item): item is string => typeof item === "string").join(" ");
      if (typeof message === "string") return message;
    }
  }
  return "Could not submit this promotion request. Please check the employee scope and try again.";
}

type SimulationEmployee = {
  id: string;
  name: string;
  role: string;
  department: string;
  departmentId: string | null;
  team: string | null;
  teamId: string | null;
  managerId: string | null;
  grossSalary: number;
  positionLevel: string | null;
  employmentStatus: string;
};

type SimulationScopeParams = {
  businessUnitId?: string;
  departmentId?: string;
  teamId?: string;
};

function toSimulationEmployee(employee: EmployeeProfile): SimulationEmployee {
  const grossSalary = Number(employee.grossSalary ?? 0);
  return {
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    role: employee.position?.title ?? "Unassigned role",
    department: employee.department?.name ?? "Unassigned",
    departmentId: employee.departmentId ?? employee.department?.id ?? null,
    team: employee.team?.name ?? null,
    teamId: employee.teamId ?? null,
    managerId: employee.managerId ?? null,
    grossSalary: Number.isFinite(grossSalary) ? grossSalary : 0,
    positionLevel: employee.position?.title ?? null,
    employmentStatus: employee.employmentStatus,
  };
}

function getSimulationScopeParams(user: ReturnType<typeof useAuth>["user"]): SimulationScopeParams {
  if (!user) return {};

  const roleTier = getRoleTier(user);
  if (roleTier === "hr_admin") return {};

  const departmentAssignment = user.roleAssignments?.find(
    (assignment) => assignment.roleCode === "MANAGER" && assignment.scope === "DEPARTMENT",
  );
  if (roleTier === "dept_manager") {
    const departmentId = departmentAssignment?.scopeEntityId ?? user.departmentId;
    return departmentId ? { departmentId } : {};
  }

  const teamAssignment = user.roleAssignments?.find(
    (assignment) => assignment.roleCode === "MANAGER" && assignment.scope === "TEAM",
  );
  const teamId = teamAssignment?.scopeEntityId ?? user.teamId;
  return teamId ? { teamId } : {};
}

function isCurrentEmployee(employee: SimulationEmployee): boolean {
  return !["TERMINATED", "RESIGNED"].includes(employee.employmentStatus);
}

function getEmployeeSalary(e: SimulationEmployee): number {
  return Number.isFinite(e.grossSalary) ? e.grossSalary : 0;
}

// ── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-start mb-6">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={stepNum} className="flex items-center flex-1 last:flex-none">
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
                data-testid={`sim-step-${stepNum}`}
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
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2 mt-[-14px]",
                  done ? "bg-green-400" : "bg-gray-200 dark:bg-gray-700"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Employee Picker ─────────────────────────────────────────────────────────

function EmployeePicker({
  employees,
  selectedId,
  onSelect,
}: {
  employees: SimulationEmployee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    );
  }, [query, employees]);

  const selected = employees.find((e) => e.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 hover:border-blue-400 transition-colors"
          data-testid="button-employee-picker"
        >
          <span
            className={cn(
              selected ? "text-gray-900 dark:text-gray-100" : "text-muted-foreground"
            )}
          >
            {selected ? `${selected.name} — ${selected.role}` : "Choose a team member…"}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              autoFocus
              placeholder="Search by name, role, or department…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
              data-testid="input-employee-search"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No matches
            </p>
          )}
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                onSelect(e.id);
                setOpen(false);
                setQuery("");
              }}
              className={cn(
                "w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center justify-between gap-2",
                e.id === selectedId && "bg-blue-50 dark:bg-blue-900/20"
              )}
              data-testid={`option-employee-${e.id}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {e.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {e.role} · {e.department}
                </p>
              </div>
              {e.id === selectedId && (
                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Promotion Wizard ────────────────────────────────────────────────────────

interface WizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: SimulationEmployee[];
  budgetEmployees: SimulationEmployee[];
  positions: PositionWithCount[];
  isSubmitting: boolean;
  onSubmit: (payload: CreatePromotionRequestPayload) => Promise<void>;
}

function PromotionWizard({
  open,
  onOpenChange,
  employees,
  budgetEmployees,
  positions,
  isSubmitting,
  onSubmit,
}: WizardProps) {
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [newSalaryStr, setNewSalaryStr] = useState("");
  const [newPositionId, setNewPositionId] = useState<string>("");
  const [newRoleTitle, setNewRoleTitle] = useState<string>("");
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [respDraft, setRespDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setEmployeeId(null);
      setNewSalaryStr("");
      setNewPositionId("");
      setNewRoleTitle("");
      setResponsibilities([]);
      setRespDraft("");
      setError(null);
    }
  }, [open]);

  const employee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employeeId, employees]
  );

  // Team budget = sum of gross salaries for everyone sharing the same manager
  const teamMembers = useMemo(() => {
    if (!employee) return [];
    if (employee.teamId) {
      return budgetEmployees.filter((e) => e.teamId === employee.teamId);
    }
    return budgetEmployees.filter(
      (e) => e.managerId === employee.managerId && e.managerId !== null
    );
  }, [budgetEmployees, employee]);

  const currentTeamBudget = useMemo(
    () => teamMembers.reduce((sum, e) => sum + getEmployeeSalary(e), 0),
    [teamMembers]
  );

  const currentSalary = employee ? getEmployeeSalary(employee) : 0;
  const newSalary = Number(newSalaryStr) || 0;
  const salaryDelta = newSalary - currentSalary;
  const salaryDeltaPct = currentSalary > 0 ? (salaryDelta / currentSalary) * 100 : 0;
  const newTeamBudget = currentTeamBudget - currentSalary + newSalary;
  const budgetImpactPct =
    currentTeamBudget > 0
      ? ((newTeamBudget - currentTeamBudget) / currentTeamBudget) * 100
      : 0;

  const newPosition = positions.find((p) => p.id === newPositionId);
  const effectiveNewRole = newPosition?.title || newRoleTitle.trim();

  function handleAddResp() {
    const t = respDraft.trim();
    if (!t) return;
    setResponsibilities((r) => [...r, t]);
    setRespDraft("");
  }

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!employeeId) return "Please pick an employee to promote.";
    }
    if (s === 2) {
      if (!newSalaryStr || newSalary <= 0)
        return "Enter the proposed new salary.";
      if (employee && newSalary <= currentSalary)
        return "The proposed salary must be greater than the current salary.";
    }
    if (s === 3) {
      if (!effectiveNewRole) return "Select a new role for this promotion.";
      if (responsibilities.length === 0)
        return "Add at least one new responsibility for this promotion.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    if (!employee) return;
    setError(null);
    try {
      await onSubmit({
        employeeId: employee.id,
        currentRole: employee.role,
        newRole: effectiveNewRole,
        currentTeamBudget,
        currentGrossSalary: currentSalary,
        newGrossSalary: newSalary,
        responsibilities,
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    }
  }

  const deltaPositive = salaryDelta >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="dialog-promotion-wizard">
        <DialogHeader>
          <DialogTitle>New Promotion Request</DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} />

        <div className="min-h-[340px] space-y-4">
          {/* Step 1 — Select Employee */}
          {step === 1 && (
            <div className="space-y-4" data-testid="sim-step-1-content">
              {employees.length === 0 ? (
                <div
                  className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground"
                  data-testid="empty-direct-reports"
                >
                  You have no direct reports to promote.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Direct report</Label>
                  <EmployeePicker
                    employees={employees}
                    selectedId={employeeId}
                    onSelect={setEmployeeId}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only employees who report directly to you appear here.
                  </p>
                </div>
              )}

              {employee && (
                <Card className="border-blue-200 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/10">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {employee.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {employee.department}
                          {employee.team ? ` · ${employee.team}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-white dark:bg-gray-900">
                        {employee.positionLevel ?? "—"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-blue-100 dark:border-blue-800/40">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Current Role
                        </p>
                        <p className="text-sm font-medium mt-0.5">{employee.role}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Current Gross Salary
                        </p>
                        <p className="text-sm font-semibold mt-0.5">
                          {fmtMoney(currentSalary)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Team Budget
                        </p>
                        <p className="text-sm font-semibold mt-0.5">
                          {fmtMoney(currentTeamBudget)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {teamMembers.length} member{teamMembers.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 2 — New Compensation */}
          {step === 2 && employee && (
            <div className="space-y-4" data-testid="sim-step-2-content">
              <div className="space-y-1.5">
                <Label>Proposed new gross salary ($)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder={String(currentSalary)}
                  value={newSalaryStr}
                  onChange={(e) => setNewSalaryStr(e.target.value)}
                  data-testid="input-new-salary"
                />
                <p className="text-xs text-muted-foreground">
                  Currently {fmtMoney(currentSalary)}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Card
                  className={cn(
                    deltaPositive
                      ? "border-green-200 dark:border-green-800/50 bg-green-50/40 dark:bg-green-900/10"
                      : "border-red-200 dark:border-red-800/50 bg-red-50/40 dark:bg-red-900/10"
                  )}
                >
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {deltaPositive ? (
                        <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                      )}
                      Salary Change
                    </div>
                    <p
                      className={cn(
                        "text-2xl font-bold tracking-tight",
                        deltaPositive
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-700 dark:text-red-400"
                      )}
                      data-testid="text-salary-delta"
                    >
                      {deltaPositive ? "+" : ""}
                      {fmtMoney(salaryDelta)}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-medium",
                        deltaPositive ? "text-green-700/80" : "text-red-700/80"
                      )}
                    >
                      {fmtPct(salaryDeltaPct)} vs current
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    deltaPositive
                      ? "border-orange-200 dark:border-orange-800/50 bg-orange-50/40 dark:bg-orange-900/10"
                      : "border-blue-200 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/10"
                  )}
                >
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      Team Budget Impact
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                      {fmtMoney(newTeamBudget)}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-medium",
                        deltaPositive
                          ? "text-orange-700 dark:text-orange-400"
                          : "text-blue-700 dark:text-blue-400"
                      )}
                      data-testid="text-budget-impact"
                    >
                      {fmtPct(budgetImpactPct)} vs {fmtMoney(currentTeamBudget)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 3 — Role & Responsibilities */}
          {step === 3 && employee && (
            <div className="space-y-4" data-testid="sim-step-3-content">
              <div className="space-y-1.5">
                <Label>New role / position</Label>
                <select
                  value={newPositionId}
                  onChange={(e) => {
                    setNewPositionId(e.target.value);
                    if (e.target.value) setNewRoleTitle("");
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
                  data-testid="select-new-position"
                >
                  <option value="">— Select a position —</option>
                  {positions
                    .slice()
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                        {p.department ? ` (${p.department})` : ""}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Or type a custom title below if the position isn't listed.
                </p>
                <Input
                  placeholder="Custom new role title (optional)"
                  value={newRoleTitle}
                  onChange={(e) => {
                    setNewRoleTitle(e.target.value);
                    if (e.target.value) setNewPositionId("");
                  }}
                  data-testid="input-custom-role"
                />
              </div>

              <div className="space-y-2">
                <Label>New responsibilities</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a responsibility…"
                    value={respDraft}
                    onChange={(e) => setRespDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddResp();
                      }
                    }}
                    data-testid="input-responsibility"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddResp}
                    data-testid="button-add-responsibility"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {responsibilities.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-1">
                    No responsibilities added yet.
                  </p>
                ) : (
                  <ul className="space-y-1.5" data-testid="list-responsibilities">
                    {responsibilities.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm bg-muted/50 rounded-md px-3 py-2"
                      >
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span className="flex-1">{r}</span>
                        <button
                          onClick={() =>
                            setResponsibilities((rs) =>
                              rs.filter((_, idx) => idx !== i)
                            )
                          }
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          aria-label="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 4 && employee && (
            <div className="space-y-3" data-testid="sim-step-4-content">
              <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Employee
                  </p>
                  <p className="text-base font-semibold mt-0.5">{employee.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {employee.department}
                    {employee.team ? ` · ${employee.team}` : ""}
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Role Change
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm">{employee.role}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        {effectiveNewRole}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Salary Change
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm">{fmtMoney(currentSalary)}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          deltaPositive
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-700 dark:text-red-400"
                        )}
                      >
                        {fmtMoney(newSalary)}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          deltaPositive ? "text-green-600" : "text-red-600"
                        )}
                      >
                        ({fmtPct(salaryDeltaPct)})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Team Budget Impact
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm">{fmtMoney(currentTeamBudget)}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      {fmtMoney(newTeamBudget)}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        deltaPositive ? "text-orange-600" : "text-blue-600"
                      )}
                    >
                      ({fmtPct(budgetImpactPct)})
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    New Responsibilities
                  </p>
                  {responsibilities.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic mt-1">None added</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {responsibilities.map((r, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-blue-600">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <p
              className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg"
              data-testid="text-wizard-error"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex !justify-between gap-2 mt-4">
          <Button
            variant="outline"
            onClick={back}
            disabled={step === 1}
            data-testid="button-wizard-back"
          >
            Back
          </Button>
          {step < 4 ? (
            <Button onClick={next} data-testid="button-wizard-next">
              Next
            </Button>
          ) : (
            <Button onClick={submit} disabled={isSubmitting} data-testid="button-wizard-submit">
              <Check className="w-4 h-4 mr-1.5" />
              {isSubmitting ? "Submitting..." : "Confirm & Submit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Simulation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [positions, setPositions] = useState<PositionWithCount[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const roleTier = user ? getRoleTier(user) : "employee";
  const isHrSimulation = roleTier === "hr_admin";
  const canReviewPromotions = Boolean(
    user?.roles?.some((role) => ["HR_ADMIN", "GLOBAL_HR_ADMIN"].includes(role)) ||
      user?.roleAssignments?.some((assignment) =>
        ["HR_ADMIN", "GLOBAL_HR_ADMIN"].includes(assignment.roleCode),
      ),
  );
  const simulationScopeParams = useMemo(() => getSimulationScopeParams(user), [user]);
  const hasSimulationScope = isHrSimulation || Boolean(simulationScopeParams.departmentId || simulationScopeParams.teamId);
  const simulationScopeLabel = isHrSimulation
    ? "All employees are available for HR simulation."
    : "Only employees in your managed teams are available for simulation.";

  const { data: employeesResult } = useQuery({
    queryKey: ["simulation-employees", simulationScopeParams],
    queryFn: () => getEmployees({ limit: 500, includeCompensation: true, ...simulationScopeParams }),
    enabled: Boolean(user && hasSimulationScope),
  });
  const allEmployees = useMemo(
    () => (employeesResult?.data ?? []).map(toSimulationEmployee),
    [employeesResult]
  );
  const promotionCandidates = useMemo(() => {
    if (isHrSimulation) {
      return allEmployees.filter(
        (employee) => employee.id !== user?.employeeId && isCurrentEmployee(employee),
      );
    }
    return allEmployees.filter(
      (employee) => employee.id !== user?.employeeId && isCurrentEmployee(employee),
    );
  }, [allEmployees, isHrSimulation, user?.employeeId]);
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["promotion-requests", "simulation", simulationScopeParams],
    queryFn: () => getPromotionRequests(simulationScopeParams),
    enabled: Boolean(user && hasSimulationScope),
  });
  const createPromotionMutation = useMutation({
    mutationFn: createPromotionRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-requests-dashboard"] });
    },
  });
  const approvePromotionMutation = useMutation({
    mutationFn: (id: string) => approvePromotionRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-requests-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      toast({ title: "Promotion request validated" });
    },
    onError: (error) => {
      toast({
        title: "Could not validate request",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    },
  });
  const rejectPromotionMutation = useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote: string }) =>
      rejectPromotionRequest(id, reviewNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-requests"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-requests-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      toast({ title: "Promotion request refused" });
    },
    onError: (error) => {
      toast({
        title: "Could not refuse request",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    },
  });
  const reviewDisabled =
    requestsLoading || approvePromotionMutation.isPending || rejectPromotionMutation.isPending;

  function handleRejectPromotion(id: string): void {
    const reviewNote = window.prompt("Reason for refusal");
    if (!reviewNote?.trim()) return;
    rejectPromotionMutation.mutate({ id, reviewNote: reviewNote.trim() });
  }

  useEffect(() => {
    getPositions()
      .then(setPositions)
      .catch(() => setPositions([]));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            data-testid="heading-simulation"
          >
            Simulation
          </h1>
          <p className="text-muted-foreground mt-1">
            Model the financial and organizational impact of a promotion before
            submitting the request.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {simulationScopeLabel}
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => setWizardOpen(true)}
          disabled={!hasSimulationScope}
          data-testid="button-new-promotion"
        >
          <Plus className="w-4 h-4" />
          New Promotion Request
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Promotion Requests
          </CardTitle>
          <CardDescription>
            Requests submitted to HR Core and visible in your current scope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading promotion requests...</p>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="empty-requests">
              <Briefcase className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm">No promotion requests yet.</p>
              <p className="text-xs mt-1">
                Click "New Promotion Request" to start one.
              </p>
            </div>
          ) : (
            <ul className="space-y-3" data-testid="list-promotion-requests">
              {requests.map((r) => {
                const positive = r.salaryDelta >= 0;
                return (
                  <li
                    key={r.id}
                    className="border rounded-lg p-4 hover:border-blue-300 transition-colors bg-white dark:bg-gray-900"
                    data-testid={`request-${r.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {r.employeeName}
                          </p>
                          <Badge
                            className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0"
                            data-testid={`badge-status-${r.id}`}
                          >
                            {r.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span>{r.currentRole}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-medium text-blue-700 dark:text-blue-400">
                            {r.newRole}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        Submitted {fmtDate(r.submittedAt)}
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Salary
                        </p>
                        <p className="text-sm font-medium mt-0.5">
                          {fmtMoney(r.currentGrossSalary)} -&gt; {fmtMoney(r.newGrossSalary)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Salary Change
                        </p>
                        <p
                          className={cn(
                            "text-sm font-semibold mt-0.5",
                            positive ? "text-green-700" : "text-red-700"
                          )}
                        >
                          {positive ? "+" : ""}
                          {fmtMoney(r.salaryDelta)} ({fmtPct(r.salaryDeltaPercentage)})
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Budget Impact
                        </p>
                        <p
                          className={cn(
                            "text-sm font-semibold mt-0.5",
                            positive ? "text-orange-700" : "text-blue-700"
                          )}
                        >
                          {fmtPct(r.budgetImpactPercentage)}
                        </p>
                      </div>
                    </div>
                    {canReviewPromotions && r.status === "PENDING" && (
                      <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs text-emerald-700"
                          onClick={() => approvePromotionMutation.mutate(r.id)}
                          disabled={reviewDisabled}
                          data-testid={`button-validate-simulation-promotion-${r.id}`}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Validate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs text-red-700"
                          onClick={() => handleRejectPromotion(r.id)}
                          disabled={reviewDisabled}
                          data-testid={`button-refuse-simulation-promotion-${r.id}`}
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" />
                          Refuse
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <PromotionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        employees={promotionCandidates}
        budgetEmployees={allEmployees}
        positions={positions}
        isSubmitting={createPromotionMutation.isPending}
        onSubmit={async (payload) => {
          await createPromotionMutation.mutateAsync(payload);
        }}
      />
    </div>
  );
}
