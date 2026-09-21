import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  getDepartments,
  getTeams,
  getBusinessUnits,
  getPositions,
  createEmployee,
} from "@/lib/api/hr-core";

/**
 * WHY value-only: each option's wording is translated. The value keys both the
 * locale entry and the payload sent to HR Core, so a label can never drift from
 * the option it belongs to. The enum copy is shared with the employee profile
 * under `employees.profile.*`.
 */
const MARITAL_STATUS_OPTS = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const;
const GENDER_OPTS = ["FEMALE", "MALE", "NON_BINARY", "PREFER_NOT_TO_SAY"] as const;
const EDUCATION_LEVEL_OPTS = ["BELOW_COLLEGE", "COLLEGE", "BACHELOR", "MASTER", "DOCTOR"] as const;
const EMPLOYMENT_STATUS_OPTS = ["ACTIVE", "ON_LEAVE", "PROBATION", "TERMINATED"] as const;
const CONTRACT_TYPE_OPTS = ["FULL_TIME", "PART_TIME", "INTERN", "CONTRACTOR", "FIXED_TERM"] as const;

const STEP_KEYS = ["personal", "employment", "organization", "review"] as const;

const BLANK_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  educationLevel: "",
  educationField: "",
  hireDate: new Date().toISOString().slice(0, 10),
  employmentStatus: "ACTIVE",
  contractType: "FULL_TIME",
  managerId: "",
  buId: "",
  departmentId: "",
  teamId: "",
  positionId: "",
  grossSalary: "",
  netSalary: "",
};

type EmployeeListItem = { id: string; name: string };

interface AddEmployeeWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allEmployees: EmployeeListItem[];
  onEmployeeAdded: () => void;
}

function StepIndicator({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-start mb-6" data-testid="wizard-step-indicator">
      {labels.map((label, i) => {
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
                  active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-2 mt-[-14px]",
                  done ? "bg-green-500" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground min-w-[130px] flex-shrink-0">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 font-medium break-all">{value}</span>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {title}
      </p>
      <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-1.5">{children}</div>
    </div>
  );
}

export function AddEmployeeWizard({
  open,
  onOpenChange,
  allEmployees,
  onEmployeeAdded,
}: AddEmployeeWizardProps) {
  const { t } = useTranslation(["employees", "common"]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");

  const { data: businessUnits = [] } = useQuery({
    queryKey: ["business-units"],
    queryFn: getBusinessUnits,
    enabled: open,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
    enabled: open,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: getTeams,
    enabled: open,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: getPositions,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      onEmployeeAdded();
      onOpenChange(false);
    },
    onError: () => setSubmitError("Failed to create employee. Please try again."),
  });

  useEffect(() => {
    if (open) {
      setStep(1);
      setForm({ ...BLANK_FORM, hireDate: new Date().toISOString().slice(0, 10) });
      setErrors({});
      setSubmitError("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDepts = useMemo(
    () => (form.buId ? departments.filter((d) => d.businessUnitId === form.buId) : departments),
    [form.buId, departments],
  );

  const filteredTeams = useMemo(
    () => (form.departmentId ? teams.filter((t) => t.departmentId === form.departmentId) : teams),
    [form.departmentId, teams],
  );

  const today = new Date().toISOString().slice(0, 10);

  const field = (key: keyof typeof BLANK_FORM, val: string) => {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "buId") { next.departmentId = ""; next.teamId = ""; }
      if (key === "departmentId") { next.teamId = ""; next.positionId = ""; }
      if (key === "teamId") { next.positionId = ""; }
      return next;
    });
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const validateStep = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.firstName.trim()) e.firstName = t("wizard.errorFirstName");
      if (!form.lastName.trim()) e.lastName = t("wizard.errorLastName");
      if (!form.email.trim()) e.email = t("wizard.errorEmail");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t("wizard.errorEmailInvalid");
      if (!form.dateOfBirth) e.dateOfBirth = t("wizard.errorDateOfBirth");
      else if (form.dateOfBirth >= today) e.dateOfBirth = t("wizard.errorDateOfBirthPast");
      if (!form.gender) e.gender = t("wizard.errorGender");
      if (!form.maritalStatus) e.maritalStatus = t("wizard.errorMaritalStatus");
      if (!form.educationLevel) e.educationLevel = t("wizard.errorEducationLevel");
    } else if (s === 2) {
      if (!form.hireDate) e.hireDate = t("wizard.errorHireDate");
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep((s) => Math.min(s + 1, 4));
  };

  const handleBack = () => { setErrors({}); setStep((s) => Math.max(s - 1, 1)); };

  const handleSubmit = () => {
    setSubmitError("");
    createMutation.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      hireDate: form.hireDate,
      contractType: form.contractType,
      phone: form.phone.trim() || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      grossSalary: form.grossSalary || undefined,
      netSalary: form.netSalary || undefined,
      gender: form.gender || undefined,
      maritalStatus: form.maritalStatus || undefined,
      educationLevel: form.educationLevel || undefined,
      educationField: form.educationField.trim() || undefined,
      departmentId: form.departmentId || undefined,
      teamId: form.teamId || undefined,
      positionId: form.positionId || undefined,
    });
  };

  const reviewBu = businessUnits.find((b) => b.id === form.buId);
  const reviewDept = departments.find((d) => d.id === form.departmentId);
  const reviewTeam = teams.find((t) => t.id === form.teamId);
  const reviewPosition = positions.find((p) => p.id === form.positionId);
  const reviewMgr = allEmployees.find((e) => e.id === form.managerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[92vh] overflow-y-auto"
        data-testid="dialog-add-employee"
      >
        <DialogHeader>
          <DialogTitle>{t("wizard.title")}</DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} labels={STEP_KEYS.map((k) => t(`wizard.steps.${k}` as "wizard.steps.personal"))} />

        <div className="min-h-[320px] space-y-4">
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4" data-testid="wizard-step-1-content">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("wizard.firstName")}</Label>
                  <Input
                    placeholder={t("wizard.firstNamePlaceholder")}
                    value={form.firstName}
                    onChange={(e) => field("firstName", e.target.value)}
                    data-testid="input-first-name"
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("wizard.lastName")}</Label>
                  <Input
                    placeholder={t("wizard.lastNamePlaceholder")}
                    value={form.lastName}
                    onChange={(e) => field("lastName", e.target.value)}
                    data-testid="input-last-name"
                  />
                  {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("wizard.email")}</Label>
                <Input
                  type="email"
                  placeholder={t("wizard.emailPlaceholder")}
                  value={form.email}
                  onChange={(e) => field("email", e.target.value)}
                  data-testid="input-new-email"
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("wizard.phone")}</Label>
                  <Input
                    placeholder="+213 555-0100"
                    value={form.phone}
                    onChange={(e) => field("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("wizard.dateOfBirth")}</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    max={today}
                    onChange={(e) => field("dateOfBirth", e.target.value)}
                  />
                  {errors.dateOfBirth && <p className="text-xs text-red-500">{errors.dateOfBirth}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("wizard.gender")}</Label>
                  <Select value={form.gender} onValueChange={(v) => field("gender", v)}>
                    <SelectTrigger><SelectValue placeholder={t("wizard.select")} /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTS.map((o) => <SelectItem key={o} value={o}>{t(`profile.genders.${o}` as "profile.genders.MALE")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.gender && <p className="text-xs text-red-500">{errors.gender}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("wizard.maritalStatus")}</Label>
                  <Select value={form.maritalStatus} onValueChange={(v) => field("maritalStatus", v)}>
                    <SelectTrigger><SelectValue placeholder={t("wizard.select")} /></SelectTrigger>
                    <SelectContent>
                      {MARITAL_STATUS_OPTS.map((o) => <SelectItem key={o} value={o}>{t(`profile.marital.${o}` as "profile.marital.SINGLE")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.maritalStatus && <p className="text-xs text-red-500">{errors.maritalStatus}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("wizard.educationLevel")}</Label>
                  <Select value={form.educationLevel} onValueChange={(v) => field("educationLevel", v)}>
                    <SelectTrigger><SelectValue placeholder={t("wizard.select")} /></SelectTrigger>
                    <SelectContent>
                      {EDUCATION_LEVEL_OPTS.map((o) => <SelectItem key={o} value={o}>{t(`profile.education.${o}` as "profile.education.COLLEGE")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.educationLevel && <p className="text-xs text-red-500">{errors.educationLevel}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("wizard.educationField")}</Label>
                <Input
                  placeholder={t("wizard.educationFieldPlaceholder")}
                  value={form.educationField}
                  onChange={(e) => field("educationField", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Employment */}
          {step === 2 && (
            <div className="space-y-4" data-testid="wizard-step-2-content">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("wizard.hireDate")}</Label>
                  <Input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => field("hireDate", e.target.value)}
                    data-testid="input-new-hire-date"
                  />
                  {errors.hireDate && <p className="text-xs text-red-500">{errors.hireDate}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("wizard.employmentStatus")}</Label>
                  <Select value={form.employmentStatus} onValueChange={(v) => field("employmentStatus", v)}>
                    <SelectTrigger data-testid="select-employment-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_STATUS_OPTS.map((o) => <SelectItem key={o} value={o}>{t(`status.${o}` as "status.ACTIVE")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("wizard.contractType")}</Label>
                <Select value={form.contractType} onValueChange={(v) => field("contractType", v)}>
                  <SelectTrigger data-testid="select-contract-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPE_OPTS.map((o) => <SelectItem key={o} value={o}>{t(`profile.contractTypes.${o}` as "profile.contractTypes.INTERN")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("wizard.manager")}</Label>
                <Select value={form.managerId} onValueChange={(v) => field("managerId", v)}>
                  <SelectTrigger data-testid="select-new-manager">
                    <SelectValue placeholder={t("wizard.noManager")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("wizard.none")}</SelectItem>
                    {allEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Organization */}
          {step === 3 && (
            <div className="space-y-4" data-testid="wizard-step-3-content">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("wizard.businessUnit")}</Label>
                  <Select value={form.buId} onValueChange={(v) => field("buId", v)}>
                    <SelectTrigger data-testid="select-new-bu"><SelectValue placeholder={t("wizard.selectBusinessUnit")} /></SelectTrigger>
                    <SelectContent>
                      {businessUnits.slice().sort((a, b) => a.name.localeCompare(b.name)).map((bu) => (
                        <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("wizard.department")}</Label>
                  <Select
                    value={form.departmentId}
                    onValueChange={(v) => field("departmentId", v)}
                    disabled={filteredDepts.length === 0}
                  >
                    <SelectTrigger data-testid="select-new-department"><SelectValue placeholder={t("wizard.selectDepartment")} /></SelectTrigger>
                    <SelectContent>
                      {filteredDepts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("wizard.team")}</Label>
                <Select
                  value={form.teamId}
                  onValueChange={(v) => field("teamId", v)}
                  disabled={filteredTeams.length === 0}
                >
                  <SelectTrigger data-testid="select-new-team"><SelectValue placeholder={t("wizard.selectTeam")} /></SelectTrigger>
                  <SelectContent>
                    {filteredTeams.slice().sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("wizard.position")}</Label>
                <Select value={form.positionId} onValueChange={(v) => field("positionId", v)}>
                  <SelectTrigger data-testid="select-position">
                    <SelectValue placeholder={t("wizard.selectPosition")} />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.slice().sort((a, b) => a.title.localeCompare(b.title)).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-medium">{p.title}</span>
                        {p.level && <span className="ml-2 text-xs text-muted-foreground">{p.level}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 4: Compensation & Review */}
          {step === 4 && (
            <div className="space-y-5" data-testid="wizard-step-4-content">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("wizard.grossSalary")}</Label>
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
                  <Label>{t("wizard.netSalary")}</Label>
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
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("wizard.summary")}</p>

                <SummarySection title={t("wizard.personalInformation")}>
                  <SummaryRow label={t("wizard.name")} value={[form.firstName, form.lastName].filter(Boolean).join(" ") || undefined} />
                  <SummaryRow label={t("wizard.email")} value={form.email} />
                  <SummaryRow label={t("wizard.phone")} value={form.phone} />
                  <SummaryRow label={t("wizard.dateOfBirth")} value={form.dateOfBirth} />
                  <SummaryRow label={t("wizard.gender")} value={form.gender ? t(`profile.genders.${form.gender}` as "profile.genders.MALE") : undefined} />
                  <SummaryRow label={t("wizard.maritalStatus")} value={form.maritalStatus ? t(`profile.marital.${form.maritalStatus}` as "profile.marital.SINGLE") : undefined} />
                  <SummaryRow label={t("wizard.education")} value={form.educationLevel ? `${t(`profile.education.${form.educationLevel}` as "profile.education.COLLEGE")}${form.educationField ? ` · ${form.educationField}` : ""}` : undefined} />
                </SummarySection>

                <SummarySection title={t("wizard.employment")}>
                  <SummaryRow label={t("wizard.hireDate")} value={form.hireDate} />
                  <SummaryRow label={t("wizard.status")} value={t(`status.${form.employmentStatus}` as "status.ACTIVE", { defaultValue: form.employmentStatus })} />
                  <SummaryRow label={t("wizard.contract")} value={t(`profile.contractTypes.${form.contractType}` as "profile.contractTypes.INTERN", { defaultValue: form.contractType })} />
                  <SummaryRow label={t("wizard.manager")} value={reviewMgr?.name} />
                </SummarySection>

                <SummarySection title={t("wizard.organization")}>
                  <SummaryRow label={t("wizard.position")} value={reviewPosition?.title} />
                  <SummaryRow label={t("wizard.businessUnit")} value={reviewBu?.name} />
                  <SummaryRow label={t("wizard.department")} value={reviewDept?.name} />
                  <SummaryRow label={t("wizard.team")} value={reviewTeam?.name} />
                </SummarySection>

                {(form.grossSalary || form.netSalary) && (
                  <SummarySection title={t("wizard.compensation")}>
                    <SummaryRow label={t("wizard.grossSalary")} value={form.grossSalary} />
                    <SummaryRow label={t("wizard.netSalary")} value={form.netSalary} />
                  </SummarySection>
                )}

                {submitError && (
                  <p className="text-sm text-red-500 mt-2">{submitError}</p>
                )}
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
            {step === 1 ? t("common:cancel") : t("wizard.back")}
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {t("wizard.step", {
                current: step,
                total: STEP_KEYS.length,
                label: t(`wizard.steps.${STEP_KEYS[step - 1]!}` as "wizard.steps.personal"),
              })}
            </span>
            <Button
              onClick={step < 4 ? handleNext : handleSubmit}
              disabled={createMutation.isPending}
              data-testid={step === 4 ? "button-submit-employee" : "wizard-next-btn"}
            >
              {step < 4 ? t("wizard.next") : createMutation.isPending ? t("wizard.creating") : t("wizard.submit")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
